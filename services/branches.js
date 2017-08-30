var Branches = require('../models/branches');
var Servers = require('./servers');
var dnsService = require('./dns');
var ctiRequest = require('../services/cti').request;
var async = require('async');
var bcrypt = require('../services/bcrypt');
var utils = require('../lib/utils');
var debug = require('debug')('billing');
var logger = require('../modules/logger').api; 

var methods = {

	isPrefixValid: function(prefix, callback){

		// var regex = /^[a-zA-Z0-9]+$/i;
		var regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$/g;
		if(!prefix.match(regex)) return callback(null, false);

		Branches.findOne({ prefix: prefix }, function(err, result) {
			if(err) return callback(err);
			callback(null, !result);
		});

	},
	isNameValid: function(name, callback){

		Branches
		.findOne({ name: name })
		.lean()
		.exec(function (err, item){
			if(err)return callback(err);
			callback(null, item === null);

		});

	},

	isNameAndPrefixValid: function(name, prefix, callback) {
		if(!name || !prefix) return callback('MISSING_DATA');

		var regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$/g;
		if(!prefix.match(regex)) return callback(null, false);

		Branches.count({ name: name, prefix: prefix }, function(err, result) {
			if(err) return callback(err);
			callback(null, !result);
		});
	},

	/**
	 * Get branch settings from CTI server
	 * 
	 * @param  {Object}   params   oid[, customerId]
	 * @return {Object}   Branch settings
	 */

	getBranchSettings: function(params, callback){

		if(!params.oid || !params.sid) return callback('MISSING_DATA');

		var requestParams = {};
		requestParams.sid = params.sid;
		requestParams.data = {
			method: 'getBranchOptions',
			params: {oid: params.oid}
		};

		ctiRequest(requestParams, function (err, ctiResponse){
			if(err) return callback(err);
			callback(null, ctiResponse.result);
		});
	},

	getBranch: function(params, callback){
		Branches
		.findOne(params, '-__v -password -login')
		.populate('_subscription')
		.exec(function (err, branch){
			if(err) {
				return callback(err);
			}
			callback(null, branch);
		});
	},

	getBranches: function(params, callback){

		var userBranches = [], branchObj;

		Branches
		.find(params, '-__v -password -login')
		.populate('_subscription')
		.lean()
		.exec(function (err, branches){

			if(err) return callback(err);

			async.each(branches, function (branch, cb){
				// if(branch._subscription.state === 'canceled'){
				// 	cb();
				// } else {
					methods.getBranchSettings({oid: branch.oid, sid: branch.sid}, function (err, result){
						// if(err) return cb(err);
						if(err) return cb();
						branchObj = utils.extend({}, branch);
						branchObj.result = result;
						userBranches.push(branchObj);
						cb();
					});
				// }
			}, function (err){
				if(err) return callback(err);
				callback(null, userBranches);
			});
			
		});

	},

	createBranch: function(params, callback){

		if(!params.sid) return callback('MISSING_DATA');

		var branch,
			server,
			requestParams = {
				sid: params.sid,
				data: {
					method: 'createBranch',
					params: params.params
				}
			};

		async.waterfall([

			function(cb) {
				Servers.getOne({_id: params.sid}, null, function (err, result){
					if(err) {
						return cb(err);
					}
					server = result;
					requestParams.server = server;
					cb();
				});
			},
			function (cb){
				ctiRequest(requestParams, function (err, ctiResponse){
					if(err) {
						cb(err);
					} else {
						cb(null, ctiResponse.result);
					}
				});
			},
			function (branchId, cb){
				branch = new Branches({
					customerId: params.customerId,
					oid: branchId,
					sid: params.sid,
					login: params.params.adminname,
					password: params.params.adminpass,
					name: params.params.name,
					prefix: params.params.prefix,
					admin: params.params.admin,
					adminEmail: params.params.email
				});
				branch.save(function (err, newBranch){
					if(err){
						methods.deleteBranch({
							sid: params.sid,
							params: {
								oid: branchId
							}
						});
						return cb(err);
					}
					cb(null, newBranch);
				});
			},
			function(newBranch, cb) {
				dnsService.create({ prefix: newBranch.prefix, domain: server.domain }, function(err, result) {
					if(err) {
						methods.setBranchState({
							customerId: params.customerId,
							_id: newBranch._id
						} ,{
							method: 'deleteBranch',
							state: 'canceled',
							enabled: false 
						}, function(err) { 
							if(err) logger.error(err);
						});
						return cb(err);
					}
					cb(null, newBranch);
				});
			}

		], function (err, newBranch){
			if(err) {
				return callback(err);
			}
			callback(null, newBranch);
		});
	},

	updateBranch: function(params, callback){

		debug('updateBranch service: ', params);
		
		if(!params.params.oid) callback('MISSING_PARAMETER_OID');
		var bparams = params.params;
		var requestParams = {
			sid: params.sid,
			data: {
				method: 'updateBranch',
				params: bparams
			}
		};

		async.waterfall([
			function(cb) {
				ctiRequest(requestParams, function (err){
					if(err) return cb(err);
					cb();
				});
			},
			function(cb) {
				Branches.findOne({ oid: bparams.oid }, function(err, branch) {
					if(err) return cb(err);
					if(!branch) return cb('NOT_FOUND');

					if(bparams.name) branch.name = bparams.name;
					if(bparams.admin) branch.admin = bparams.admin;
					if(bparams.email) branch.email = bparams.email;
					if(bparams.adminname) branch.login = bparams.adminname;
					if(bparams.adminpass) branch.password = bparams.adminpass;

					cb(null, branch);
				});
				
			},
			function(branch, cb) {
				branch.save(function(err, result) {
					if(err) return cb(err);
					cb();
				});
			}
		], function(err) {
			if(err) return callback(err);
			callback();
		});
	},

	changePassword: function(params, callback) {
		Branches.findOne({ _id: params._id }, function(err, branch) {
			if(err) return callback(err);
			if(!branch) return callback('NOT_FOUND');

			debug('changePassword: ', params);

			branch.password = params.password;
			branch.save(function(err, result) {
				if(err) return callback(err);
				callback();
			});
		});
	},

	setBranchState: function(query, params, callback){

		if(params.enabled === undefined || !params.method) {
			if(callback) callback('Parameters are provided');
			return;
		}

		async.waterfall([
			function (cb){
				methods.getBranch(query, function (err, branch){
					if(err) return cb(err);
					if(!branch) return cb('NOT_FOUND');
					
					debug('setBranchState: ', params, branch);
					if(params.state) {
						branch._subscription.update({state: params.state}, function (err){
							if(err) return cb(err);
							cb(null, branch);
						});
					} else {
						cb(null, branch);
					}
				});
			},
			function (branch, cb){
				ctiRequest({
					sid: branch.sid,
					data: {
						method: params.method,
						params: {
							oid: branch.oid,
							enabled: params.enabled
						}
					}
				}, function (err, result){
					if(err) return cb(err);
					cb(null, branch);
				});
			},
			function (branch, cb){
				if(params.method === 'deleteBranch') {
					branch.remove(function (err){
						if(err) return cb(err);
						dnsService.remove({ prefix: branch.prefix }, function(err, result) {
							if(err) return cb(err);
							cb();
						});
					});
				} else {
					cb();
				}
					
			}], function (err){
				if(err) {
					if(callback) return callback(err);
				}
				if(callback) callback(null, 'OK');
			}
		);

	},

	deleteBranch: function(params, callback){

		var requestParams = {
			sid: params.sid,
			data: {
				method: 'deleteBranch',
				params: params.params
			}
		};
		ctiRequest(requestParams, function (err){
			if(err) {
				if(callback) callback(err);
			} else {
				if(callback) callback();
			}
		});
	}

};

module.exports = methods;
var Branches = require('../models/branches');
var Servers = require('./servers');
var dnsService = require('./dns');
var ctiRequest = require('../services/cti').request;
var async = require('async');
var utils = require('../lib/utils');
var debug = require('debug')('billing');

var methods = {

	isPrefixValid: function(prefix, callback){

		// var regex = /^[a-zA-Z0-9]+$/i;
		var regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$/g;
		if(!prefix.match(regex)) return callback(null, false);

		dnsService.get({ prefix: prefix }, function(err, result) {
			if(err) return callback(err);
			callback(null, !result.length);
		});

		// Branches
		// .findOne({ prefix: prefix })
		// .lean()
		// .exec(function (err, item){
		// 	if(err)return callback(err);
		// 	callback(null, item === null);

		// });

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
	
	/**
	 * Returns id of the server where branch is allocated.
	 * If request is made from the end user then customerId 
	 * must be provided in parameters
	 * 
	 * @param  {Object}   params oid[, customerId]
	 * @param  {Function} cb     callback
	 * @return {String}          server id
	 */
	getServerId: function(params, cb){

		Branches.findOne(params, function (err, branch){
			if(err) return cb(err);
			if(!branch) return cb('BRANCH_NOT_FOUND');
			cb(null, branch.sid);
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
		.findOne({customerId: params.customerId, oid: params.oid})
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
		.find(params, '-__v -_id')
		.populate('_subscription')
		.lean()
		.exec(function (err, branches){

			debug('getBranches: ', branches);

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
					name: params.params.name,
					prefix: params.params.prefix
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
							method: 'deleteBranch',
							customerId: params.customerId,
							result: {
								oid: newBranch.oid,
								enabled: false
							}
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

		if(!params.params.oid) callback('MISSING_PARAMETER_OID');
		var requestParams = {
			sid: params.sid,
			data: {
				method: 'updateBranch',
				params: params.params
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
				Branches.update({ oid: params.params.oid }, { $set: { name: params.params.name } }, function(err) {
					if(err) return cb(err);
					cb();
				});
			}
		], function(err) {
			if(err) {
				callback(err);
			} else {
				callback();
			}
		});
	},

	setBranchState: function(params, callback){

		if(!params.method || !params.customerId || !params.result) {
			return callback('Parameters doesn\'t provided');
		}

		var server = {};

		async.waterfall([
			function (cb){
				methods.getBranch({customerId: params.customerId, oid: params.result.oid}, function (err, branch){
					if(err){
						cb(err);
					} else if(!branch) {
						cb('Branch not found');
					} else {
						debug('setBranchState: ', params, branch);
						if(params.state !== undefined) {
							branch._subscription.update({state: params.state}, function (err){
								if(err) return cb(err);
								cb(null, branch);
							});
						} else {
							cb(null, branch);
						}
					}
				});
			},
			function (branch, cb){
				ctiRequest({
					sid: branch.sid,
					data: {
						method: params.method,
						params: params.result
					}
				}, function (err, result){
					if(err) return cb(err);
					cb(null, branch);
				});
			},
			// function(branch, cb) {
			// 	Servers.getOne({_id: branch.sid}, null, function (err, result){
			// 		if(err) {
			// 			return cb(err);
			// 		}
			// 		server = result;
			// 		cb(null, branch);
			// 	});
			// },
			function (branch, cb){
				if(params.method === 'deleteBranch') {
					branch.remove(function (err){
						if(err) return cb(err);
						// dnsService.remove({ prefix: branch.prefix, domain: server.domain }, function(err, result) {
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
					if(callback) callback(err);
					return;
				}
				if(callback)callback(null, 'OK');
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
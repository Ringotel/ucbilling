var Branches = require('../models/branches');
var Servers = require('./servers');
var dnsService = require('./dns');
var ctiRequest = require('../services/cti').request;
var async = require('async');
var bcrypt = require('../services/bcrypt');
var utils = require('../lib/utils');
var debug = require('debug')('billing');
var logger = require('../modules/logger').api; 

function isPrefixValid(prefix, callback){

	// var regex = /^[a-zA-Z0-9]+$/i;
	var regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$/g;
	if(!prefix.match(regex)) return callback(null, false);

	Branches.count({ prefix: prefix }, function(err, result) {
		if(err) return callback(err);
		callback(null, !result);
	});

}

function isNameValid(name, callback){

	Branches
	.count({ name: name }, function(err, result) {
		if(err) return callback(err);
		callback(null, !result);
	});

}

function isNameAndPrefixValid(name, prefix, callback) {
	if(!name || !prefix) return callback('MISSING_DATA');

	var regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$/g;
	if(!prefix.match(regex)) return callback(null, false);

	Branches.count({ name: name, prefix: prefix }, function(err, result) {
		if(err) return callback(err);
		callback(null, !result);
	});
}

function getBranchSettings(params, callback){

	if(!params.oid || !params.sid) return callback({ name: 'ERR_MISSING_ARGS', message: 'oid or sid is undefiend' });

	var requestParams = {
		sid: params.sid,
		data: {
			method: 'getBranchOptions',
			params: {oid: params.oid}
		}
	};

	ctiRequest(requestParams, function (err, ctiResponse){
		if(err) return callback(err);
		callback(null, ctiResponse.result);
	});
}

function create(params, callback){

	if(!params.sid) return callback({ name: 'ERR_MISSING_ARGS', message: 'sid is undefiend' });

	var branchOid, server;

	async.waterfall([

		function(cb) {
			// get server object
			Servers.findOne({_id: params.sid})
			.then(function (result){
				server = result;
				cb();
			})
			.catch(function(err) {
				cb(err);
			});
		},
		function (cb){
			// create cti branch
			ctiRequest({
				method: 'createBranch',
				params: params.params
			}, function (err, ctiResponse){
				if(err) return cb(err);
				branchOid = ctiResponse.result;
				cb();
			});
		},
		function (cb){
			// create and save new branch
			branch = new Branches({
				customerId: params.customerId,
				oid: branchOid,
				sid: params.sid,
				login: params.params.adminname,
				password: params.params.adminpass,
				name: params.params.name,
				prefix: params.params.prefix,
				admin: params.params.admin,
				adminEmail: params.params.email
			});

			branch.save()
			.then(function(newBranch) {
				cb(null, newBranch);
			})
			.catch(function(err) {
				ctiRequest({
					method: 'deleteBranch',
					params: { oid: branch.oid }
				}, function (err){
					return cb(err);
				});
			});
		},
		function(newBranch, cb) {
			dnsService.create({ prefix: newBranch.prefix, domain: server.domain }, function(err, result) {
				if(err) {
					// clean
					deleteBranch(newBranch, function(err, result) {
						if(err) logger.error('createBranch clean error: %j: branch: %j', err, newBranch);
					});
					return cb(err);
				}
				cb(null, newBranch);
			});
		}

	], function (err, newBranch){
		if(err) return callback(err);
		callback(null, newBranch);
	});
}

function deleteBranch(branch, callback){
	var promise = (typeof branch === 'function') ? 
		( new Promise((resolve, reject) => { resolve(branch); }) ) : 
		Customers.findOne({ _id: branch });
	var requestParams = {};

	promise.then(function(result) {
		requestParams = {
			sid: result.sid,
			data: {
				method: 'deleteBranch',
				params: {
					oid: branch.oid
				}
			}
		};

		ctiRequest(requestParams, function (err){
			if(err) {
				callback(err);
			} else {
				branch.remove()
				.then(function (){
					dnsService.remove({ prefix: branch.prefix })
					.then(cb)
					.catch(err => callback(err));
				})
				.catch(err => callback(err));
			}
		});
		
	}).catch(err => callback(err));
}

var methods = {
	isPrefixValid: isPrefixValid,
	isNameValid: isNameValid,
	isNameAndPrefixValid: isNameAndPrefixValid,
	getBranchSettings: getBranchSettings,
	create: create,
	delete: deleteBranch,

	/**
	 * Get branch settings from CTI server
	 * 
	 * @param  {Object}   params   oid[, customerId]
	 * @return {Object}   Branch settings
	 */

	// createBranch: function(params, callback){

	// 	if(!params.sid) return callback({ name: 'ERR_MISSING_ARGS', message: 'sid is undefiend' });

	// 	var branchOid, server;

	// 	async.waterfall([

	// 		function(cb) {
	// 			// get server object
	// 			Servers.findOne({_id: params.sid})
	// 			.then(function (result){
	// 				server = result;
	// 				cb();
	// 			})
	// 			.catch(function(err) {
	// 				cb(err);
	// 			});
	// 		},
	// 		function (cb){
	// 			// create cti branch
	// 			ctiRequest({
	// 				method: 'createBranch',
	// 				params: params.params
	// 			}, function (err, ctiResponse){
	// 				if(err) return cb(err);
	// 				branchOid = ctiResponse.result;
	// 				cb();
	// 			});
	// 		},
	// 		function (cb){
	// 			// create and save new branch
	// 			branch = new Branches({
	// 				customerId: params.customerId,
	// 				oid: branchOid,
	// 				sid: params.sid,
	// 				login: params.params.adminname,
	// 				password: params.params.adminpass,
	// 				name: params.params.name,
	// 				prefix: params.params.prefix,
	// 				admin: params.params.admin,
	// 				adminEmail: params.params.email
	// 			});

	// 			branch.save()
	// 			.then(function(newBranch) {
	// 				cb(null, newBranch);
	// 			})
	// 			.catch(function(err) {
	// 				ctiRequest({
	// 					method: 'deleteBranch',
	// 					params: { oid: branch.oid }
	// 				}, function (err){
	// 					return cb(err);
	// 				});
	// 			});
	// 		},
	// 		function(newBranch, cb) {
	// 			dnsService.create({ prefix: newBranch.prefix, domain: server.domain }, function(err, result) {
	// 				if(err) {
	// 					// clean
	// 					deleteBranch(newBranch, function(err, result) {
	// 						if(err) logger.error('createBranch clean error: %j: branch: %j', err, newBranch);
	// 					});
	// 					return cb(err);
	// 				}
	// 				cb(null, newBranch);
	// 			});
	// 		}

	// 	], function (err, newBranch){
	// 		if(err) return callback(err);
	// 		callback(null, newBranch);
	// 	});
	// },

	// updateBranch: function(branch, callback){
	// 	var promise = (typeof branch === 'function') ? 
	// 			( new Promise((resolve, reject) => { resolve(branch); }) ) : 
	// 			Customers.findOne({ _id: branch });

	// 	debug('updateBranch service: ', branch);
		
	// 	var bparams = params.params;
	// 	var requestParams = {
	// 		sid: params.sid,
	// 		data: {
	// 			method: 'updateBranch',
	// 			params: bparams
	// 		}
	// 	};

	// 	async.waterfall([
	// 		function(cb) {
	// 			ctiRequest(requestParams, function (err){
	// 				if(err) return cb(err);
	// 				cb();
	// 			});
	// 		},
	// 		function(cb) {
	// 			Branches.findOne({ oid: bparams.oid }, function(err, branch) {
	// 				if(err) return cb(err);
	// 				if(!branch) return cb('NOT_FOUND');

	// 				if(bparams.name) branch.name = bparams.name;
	// 				if(bparams.adminname) branch.login = bparams.adminname;
	// 				if(bparams.adminpass) branch.password = bparams.adminpass;

	// 				cb(null, branch);
	// 			});
				
	// 		},
	// 		function(branch, cb) {
	// 			branch.save(function(err, result) {
	// 				if(err) return cb(err);
	// 				cb();
	// 			});
	// 		}
	// 	], function(err) {
	// 		if(err) return callback(err);
	// 		callback();
	// 	});
	// },

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

	}

	// deleteBranch: function(branch, callback){
	// 	var promise = (typeof branch === 'function') ? 
	// 		( new Promise((resolve, reject) => { resolve(branch); }) ) : 
	// 		Customers.findOne({ _id: branch });
	// 	var requestParams = {};

	// 	promise.then(function(result) {
	// 		requestParams = {
	// 			sid: result.sid,
	// 			data: {
	// 				method: 'deleteBranch',
	// 				params: { oid: result.oid }
	// 			}
	// 		};

	// 		ctiRequest(requestParams, function (err){
	// 			if(err) {
	// 				callback(err);
	// 			} else {
	// 				branch.remove()
	// 				.then(function (){
	// 					dnsService.remove({ prefix: branch.prefix })
	// 					.then(cb)
	// 					.catch(err => callback(err));
	// 				})
	// 				.catch(err => callback(err));
	// 			}
	// 		});
			
	// 	}).catch(err => callback(err));
	// }

};

module.exports = methods;
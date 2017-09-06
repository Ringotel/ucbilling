var async = require('async');
var debug = require('debug')('billing');
var dnsService = require('./dns');
var cti = require('./cti');
var bcrypt = require('./bcrypt');
var Branches = require('../models/branches');
var Servers = require('../models/servers');
var utils = require('../lib/utils');
var logger = require('../modules/logger').api; 

module.exports = {
	isPrefixValid: isPrefixValid,
	isNameValid: isNameValid,
	isNameAndPrefixValid: isNameAndPrefixValid,
	getBranchSettings: getBranchSettings,
	get: get,
	create: create,
	setState: setState,
	delete: deleteBranch,
	changePassword: changePassword
};

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
		if(err) return callback(new Error(err));
		callback(null, !result);
	});

}

function isNameAndPrefixValid(name, prefix, callback) {
	if(!name || !prefix) return callback('MISSING_DATA');

	var regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$/g;
	if(!prefix.match(regex)) return callback(null, false);

	Branches.count({ name: name, prefix: prefix }, function(err, result) {
		if(err) return callback(new Error(err));
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

	cti.request(requestParams, function (err, ctiResponse){
		if(err) return callback(err);
		callback(null, ctiResponse.result);
	});
}

function get(params) {
	return Branches.findOne(params, '-__v -password -login');
}

function create(params, callback){

	if(!params.sid) return callback({ name: 'ERR_MISSING_ARGS', message: 'sid is undefiend' });
	if(!params.customerId) return callback({ name: 'ERR_MISSING_ARGS', message: 'customer is undefiend' });

	var server;

	async.waterfall([

		function(cb) {
			// get server object
			Servers.findOne({_id: params.sid})
			.then((result) => {
				server = result;
				cb();
			})
			.catch((err) => {
				debug('createBranch cb:', cb);
				cb(new Error(err))
			});
		},
		function (cb){
			// create cti branch
			cti.request({
				sid: params.sid,
				data: {
					method: 'createBranch',
					params: params.branchParams
				}
			}, function (err, ctiResponse){
				if(err) return cb(err);
				cb(null, ctiResponse.result);
			});
		},
		function (oid, cb){
			// create and save new branch			
			let branch = new Branches(params.branchParams);
			branch.oid = oid;
			branch.sid = params.sid;
			branch.customer = params.customerId;

			debug('createBranch new branch object:', branch);

			branch.save()
			.then(newBranch => {
				debug('createBranch save branch success:', newBranch);
				cb(null, newBranch);
			})
			.catch(err => {
				debug('createBranch save branch error:', err);
				// clean
				cti.request({
					sid: params.sid,
					data: {
						method: 'deleteBranch',
						params: { oid: branch.oid }
					}
				}, function (err){
					logger.error('createBranch clean error: %j: branch: %j', err, branch);
				});

				cb(new Error(err));
			});
		},
		function(newBranch, cb) {
			return cb(null, newBranch); // TEST

			dnsService.create({ prefix: newBranch.prefix, domain: server.domain })
			.then((result) => { cb(null, newBranch) })
			.catch(err => {
				// clean
				deleteBranch(newBranch, function(err, result) {
					if(err) logger.error('createBranch clean error: %j: branch: %j', err, newBranch);
				});
				return cb(new Error(err));
			});
		}

	], function (err, newBranch){
		debug('createBranch error:', err);
		if(err) return callback(err);
		callback(null, newBranch);
	});
}

function setState(params, callback) {
	var promise = (typeof params.branch === 'function') ? 
		( new Promise((resolve, reject) => { resolve(params.branch); }) ) : 
		Branches.findOne({ _id: params.branch });

	promise.then(function(result) {
		requestParams = {
			sid: result.sid,
			data: {
				method: 'setBranchState',
				params: {
					oid: result.oid,
					enabled: params.enabled
				}
			}
		};

		cti.request(requestParams, function (err){
			if(err) logger.error('setBranchState error: %j: params: %j', err, params);
			callback(err || null);
		});
		
	}).catch(err => {
		callback(new Error(err));
	});
}

function deleteBranch(branch, callback){
	var promise = (typeof branch === 'function') ? 
		( new Promise((resolve, reject) => { resolve(branch); }) ) : 
		Branches.findOne({ _id: branch });

	var requestParams = {};

	promise.then(function(result) {
		requestParams = {
			sid: result.sid,
			data: {
				method: 'deleteBranch',
				params: { oid: result.oid }
			}
		};

		cti.request(requestParams, function (err){
			if(err) {
				callback(err);
			} else {
				result.remove()
				.then(function (){
					dnsService.remove({ prefix: result.prefix })
					.then(cb)
					.catch(err => callback(new Error(err)));
				})
				.catch(err => callback(new Error(err)));
			}
		});
		
	}).catch(err => callback(new Error(err)));
}

function changePassword(params, callback) {
	Branches.findOne({ _id: params._id }, function(err, branch) {
		if(err) return callback(new Error(err));
		if(!branch) return callback({ name: 'ENOENT', message: 'branch not found' });

		debug('changePassword: ', params);

		branch.password = params.password;
		branch.save(function(err, result) {
			if(err) return callback(new Error(err));
			callback();
		});
	});
}

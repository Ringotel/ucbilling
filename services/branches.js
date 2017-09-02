var Branches = require('../models/branches');
var Servers = require('./servers');
var dnsService = require('./dns');
var ctiRequest = require('../services/cti').request;
var async = require('async');
var bcrypt = require('../services/bcrypt');
var utils = require('../lib/utils');
var debug = require('debug')('billing');
var logger = require('../modules/logger').api; 

module.exports = {
	isPrefixValid: isPrefixValid,
	isNameValid: isNameValid,
	isNameAndPrefixValid: isNameAndPrefixValid,
	getBranchSettings: getBranchSettings,
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
				// clean
				ctiRequest({
					method: 'deleteBranch',
					params: { oid: branch.oid }
				}, function (err){
					logger.error('createBranch clean error: %j: branch: %j', err, branch);
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

function setState(params, callback) {
	var enabled = params.enabled;
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
					enabled: enabled
				}
			}
		};

		ctiRequest(requestParams, function (err){
			if(err) logger.error('setBranchState error: %j: params: %j', err, params);
			if(callback) callback(err || null);
		});
		
	}).catch(err => {
		if(callback) callback(err);
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
				params: {
					oid: result.oid
				}
			}
		};

		ctiRequest(requestParams, function (err){
			if(err) {
				callback(err);
			} else {
				result.remove()
				.then(function (){
					dnsService.remove({ prefix: result.prefix })
					.then(cb)
					.catch(err => callback(err));
				})
				.catch(err => callback(err));
			}
		});
		
	}).catch(err => callback(err));
}

function changePassword(params, callback) {
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
}

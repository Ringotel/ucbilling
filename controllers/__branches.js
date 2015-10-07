var Branches = require('../models/branches');
var ctiRequest = require('./cti').request;
var async = require('async');
var utils = require('../lib/utils');
var debug = require('debug')('billing');
var logger = require('../modules/logger');

var methods = {

	getCtiBranches: function(callback){

		var branches = [],
			requestParams = {};

		Branches.find({}, function (err, items){

			if(err){
				return callback(err);
			}

			async.each(items, function (item, cb){

				requestParams.sid = item.sid;
				requestParams.data = {
					method: 'getBranches'
				};

				ctiRequest(requestParams, function (err, ctiResponse){
					if(err) return cb(err);
					branches = branches.concat(ctiResponse.result);
					cb();
				});

			}, function (err){
				if(err) {
					return callback(err);
				}
				callback(null, branches);
			});

		});

	},

	isPrefixAvailable: function(prefix, callback){

		Branches.find({ prefix: prefix }, function (err, item){

			if(err) {
				return callback(err);
			}

			callback(null, (item === undefined));

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
			if(!branch) return cb('Branch not found');
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

		if(!params.oid) return callback('No oid provided');

		var requestParams = {};

		async.waterfall([
			function (cb){
				if(params.sid){
					cb(null, params.sid);
				} else {
					methods.getServerId(params, function (err, sid){
						if(err) {
							return cb(err);
						}
						cb(null, sid);
					});
				}
			},
			function (sid, cb){
				requestParams.sid = sid;
				requestParams.data = {
					method: 'getBranchOptions',
					params: {oid: params.oid}
				};

				ctiRequest(requestParams, function (err, ctiResponse){
					if(err) return cb(err);
					cb(null, ctiResponse.result);
				});
			}
		], function (err, result){
			if(err) {
				return callback(new Error(err));
			}
			callback(null, result);
		});

	},

	getBranch: function(params, callback){

		var branchObj;

		async.waterfall([
			function (cb){
				Branches.findOne({customerId: params.customerId, oid: params.oid}, '-__v -_id').populate('_subscription').lean().exec(function (err, branch){
					if(err) {
						return cb(err);
					}
					cb(null, branch);
				});
			}, function (branch, cb){
				methods.getBranchSettings({oid: branch.oid, sid: branch.sid}, function (err, result){
					if(err) return cb(err);
					branchObj = utils.extend({}, branch);
					branchObj.result = result;
					cb(null, branchObj);
				});
			}

		], function (err, branchObj){
			if(err) {
				return callback(err);
			}
			callback(null, branchObj);
		});

	},

	getBranches: function(params, callback){

		var userBranches = [], branchObj;

		Branches.find(params, '-__v -_id').populate('_subscription').lean().exec(function (err, branches){

			if(err) {
				return callback(err);
			}

			async.each(branches, function (branch, cb){

				if(branch._subscription.state === 'canceled'){
					cb();
				} else {
					methods.getBranchSettings({oid: branch.oid, sid: branch.sid}, function (err, result){
						if(err) return cb(err);
						branchObj = utils.extend({}, branch);
						branchObj.result = result;
						userBranches.push(branchObj);
						cb();
					});
				}

			}, function (err){
				if(err) {
					return callback(err);
				}
				callback(null, userBranches);
			});
			
		});

	},

	createBranch: function(params, callback){

		if(!params.sid) return callback('Server ID is not provided');

		var branch,
			requestParams = {
			sid: params.sid,
			data: {
				method: 'createBranch',
				params: params.params
			}
		};

		async.waterfall([

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
			}

		], function (err, newBranch){
			if(err) {
				return callback(err);
			}
			callback(null, newBranch);
		});
	},

	updateBranch: function(params, callback){

		var requestParams = {
			sid: params.sid,
			data: {
				method: 'updateBranch',
				params: params.params
			}
		};
		ctiRequest(requestParams, function (err){
			if(err) {
				callback(err);
			} else {
				callback();
			}
		});

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
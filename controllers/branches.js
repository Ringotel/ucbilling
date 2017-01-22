var BranchesService = require('../services/branches');
var SubscriptionsService = require('../services/subscriptions');
var async = require('async');
var utils = require('../lib/utils');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');

var methods = {

	isPrefixValid: function(req, res, next){

		var params = req.body;

		BranchesService.isPrefixValid(params.prefix, function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: result
			});
		});

	},

	isNameValid: function(req, res, next){

		var params = req.body;
		BranchesService.isNameValid(params.name, function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}
			
			res.json({
				success: true,
				result: result
			});
		});

	},
	
	getBranch: function(req, res, next){
		var queryParams = {customerId: req.decoded._id, oid: req.params.oid},
			branchObj = {};
		
		async.waterfall([
			function (cb){
				BranchesService.getBranch(queryParams, function (err, branch){
					if(err) return cb(err);
					cb(null, branch);
				});
			},
			function (branch, cb){
				BranchesService.getBranchSettings({oid: branch.oid, sid: branch.sid}, function (err, result){
					if(err) return cb(err);
					branchObj = utils.extend({}, branch.toObject());
					branchObj.result = result;
					cb(null, branchObj);
				});
			}
		], function (err, branchObj){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: branchObj
			});
		});
	},

	getBranches: function(req, res, next){
		var queryParams = { customerId: req.decoded._id };
		BranchesService.getBranches(queryParams, function (err, branches){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: branches
			});
		});
	},

	updateBranch: function(req, res, next){

		var params = req.body;
		var oid = req.params.oid;

		async.waterfall([
			function (cb){
				BranchesService.getBranch({customerId: params.customerId, oid: oid}, function (err, branch){
					if(err) return cb(err);
					params.result.oid = oid;
					BranchesService.updateBranch({ sid: branch.sid, params: params.result }, function (err){
						if(err) {
							cb(err);
						} else {
							cb(null, branch._subscription);
						}
					});
				});
			},
			function (sub, cb){

				SubscriptionsService.update(sub, params._subscription, function (err){
					if(err) return cb(err); //TODO - handle the error. Possible solution - retry logic
					cb();
				});

			}], function (err){
				if(err){
					return res.json({
						success: false,
						message: err
					});
				}

				res.json({
					success: true
				});
			}
		);

	},

	activateBranch: function(req, res, next){

		var params = req.body,
			requestParams = {
				customerId: params.customerId,
				method: 'setBranchState',
				state: 'active',
				result: {
					oid: params.oid,
					enabled: true
				}
			};

		BranchesService.setBranchState(requestParams, function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: result
			});
		});

	},

	pauseBranch: function(req, res, next){

		var params = req.body,
			requestParams = {
				customerId: params.customerId,
				method: 'setBranchState',
				state: 'paused',
				result: {
					oid: params.oid,
					enabled: false
				}
			};

		BranchesService.setBranchState(requestParams, function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: result
			});
		});

	},

	deleteBranch: function(req, res, next){

		var params = req.body,
			requestParams = {
				customerId: params.customerId,
				method: 'deleteBranch',
				state: 'canceled',
				result: {
					oid: params.oid
				}
			};

		// BranchesService.deleteBranch({ sid: params.sid, params: { oid: params.oid } }, function (err, result){
		BranchesService.setBranchState(requestParams, function (err, result){
			
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: result
			});
		});

	}

};

module.exports = methods;

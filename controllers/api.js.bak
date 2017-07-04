var config = require('../env/index');
var SubscriptionsService = require('../services/subscriptions');
var CustomersService = require('../services/customers');
var Transactions = require('../services/transactions');
var BranchesService = require('../services/branches');
var PlansService = require('../services/plans');
var ServersService = require('../services/servers');
var async = require('async');
var utils = require('../lib/utils');
var Liqpay = require('../liqpay/index');
var request = require('request');
var moment = require('moment');
var debug = require('debug')('billing');
var logger = require('../modules/logger').api;

var liqpayPubKey = config.liqpay.publickey;
var liqpayPrivKey = config.liqpay.privatekey;
var liqpay = new Liqpay(liqpayPubKey, liqpayPrivKey);

var methods = {
	
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
			if(err) return next(new Error(err));
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
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: branches
			});
		});
	},

	isPrefixValid: function(req, res, next){

		var params = req.body;

		BranchesService.isPrefixValid(params.prefix, function (err, result){
			if(err) {
				return next(new Error(err));
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
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: result
			});
		});

	},

	canCreateTrialSub: function(req, res, next){
		SubscriptionsService.canCreateTrialSub(req.decoded, function(err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});
	},

	createSubscription: function(req, res, next){
		var params = req.body;
		params.customer = req.decoded;
		SubscriptionsService.createSubscription(params, function (err, result){
			if(err) {
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: result
			});
		});
	},

	updateSubscription: function(req, res, next) {
		var params = req.body;
		SubscriptionsService.updateSubscription(params, function(err, result) {
			if(err) {
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: result
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
					next(new Error(err));
				} else {
					res.json({
						success: true
					});
				}
			}
		);

	},

	getPlans: function(req, res, next){
		var params = req.body;
		PlansService.get({ currency: req.decoded.currency, _state: '1' }, '-updatedAt -createdAt -_state', function (err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});
			
	},

	getServers: function(req, res, next){
		var params = req.body;
		ServersService.get({ state: '1' }, '_id name countryCode', function (err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});
	},

	changePlan: function(req, res, next){
		var params = req.body;
		SubscriptionsService.changePlan(params, function (err, result){
			if(err) {
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: result
			});
		});
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
				return next(new Error(err));
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
				return next(new Error(err));
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

		BranchesService.setBranchState(requestParams, function (err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});

	},

	renewSubscription: function(req, res, next){
		var params = req.body;
		SubscriptionsService.renewSubscription(params, function (err, result){
			if(err) {
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: result
			});
		});
	},

	getSubscriptionAmount: function(req, res, next){

		var params = req.body;
	
		debug('getAmount params: ', params);

		SubscriptionsService.getAmount(params, function (err, amount){
			debug('getAmount result: ', err, amount);
			if(err){
				next(new Error(err));
			} else {
				res.json({
					result: amount
				});
			}
		});
	}
 };

 module.exports = methods;
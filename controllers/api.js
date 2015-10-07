var config = require('../env/index');
var SubscriptionsService = require('../services/subscriptions');
var CustomersService = require('../services/customers');
var Transactions = require('../services/transactions');
var BranchesService = require('../services/branches');
var PlansService = require('../services/plans');
var ServersService = require('../services/servers');
var ctiRequest = require('./cti').request;
var async = require('async');
var utils = require('../lib/utils');
var bhelper = require('../lib/bhelper');
var Liqpay = require('liqpay');
var request = require('request');
var https = require('https');
var moment = require('moment');
var debug = require('debug')('billing');
var logger = require('../modules/logger');

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

	createSubscription: function(req, res, next){
		var params = req.body;
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
		PlansService.get({ currency: req.decoded.currency }, '-updatedAt -createdAt', function (err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});
	},

	getServers: function(req, res, next){
		var params = req.body;
		ServersService.get({}, '_id name', function (err, result){
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

		methods.setBranchState(requestParams, function (err, result){
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

		methods.setBranchState(requestParams, function (err, result){
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

		methods.setBranchState(requestParams, function (err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});

	},

	setBranchState: function(params, callback){

		if(!params.method || !params.customerId || !params.result) {
			return callback('Parameters doesn\'t provided');
		}

		async.waterfall([
			function (cb){
				BranchesService.getBranch({customerId: params.customerId, oid: params.result.oid}, function (err, branch){
					if(err){
						cb(err);
					} else if(!branch) {
						cb('Branch not found');
					} else {
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
			function (branch, cb){
				if(params.method === 'deleteBranch') {
					branch.remove(function (err){
						if(err) return cb(err);
						cb();
					});
				} else {
					cb();
				}
					
			}], function (err){
				if(err) return callback(err);
				callback(null, 'OK');
			}
		);

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

	/**
	 * Add credits for customer account
	 * branch on payment success
	 * @param  {object} amount, customer id
	 * @return {object} operation result
	 */
	checkout: function(req, res, next){

		var params = req.body;
		//TODO - check if customer has enough credits
		if(!params.amount) {
			if(params.order) {
				methods.handleOrder(req.decoded._id, params.order, function (err){
					if(err) {
						return next(new Error(err));
					}
					res.json({
						success: true
					});
				});
			} else {
				return next(new Error('NO_DATA'));
			}
		} else {
			var baseUrl = config.liqpay.resultUrl;
			var serverUrl = baseUrl + '/api/checkoutResult';
			serverUrl += '?id='+req.decoded._id;

			if(params.order) {
				serverUrl += '&order=';
				// serverUrl += encodeURIComponent(new Buffer(JSON.stringify(params.sub)).toString('base64'));
				serverUrl += new Buffer(JSON.stringify(params.order)).toString('base64');
				// serverUrl += new Buffer(params.order).toString('base64');
			}
			var order_id = moment().unix();
			var paymentParams = {
				version: '3',
				amount: params.amount,
				public_key: liqpayPubKey,
				currency: req.decoded.currency,
				description: 'Test payment',
				// order_id: require('shortid').generate(),
				order_id: order_id,
				server_url: serverUrl,
				result_url: baseUrl,
				sandbox: 1
			};

			debug('liqpay params: ', paymentParams);

			var signature = liqpay.cnb_signature(paymentParams);
			var data = new Buffer(JSON.stringify(paymentParams)).toString('base64');

			debug('liqpay signature: ', signature);

			request.post('https://www.liqpay.com/api/checkout', {form: {data: data, signature: signature}}, function (err, r, result){
				if(err){
					debug('liqpay error: ', err);
					return next(new Error(err));
				}

				var locationHeader = r.headers['Location'] ? 'Location' : 'location';
				
				if(r.statusCode === 302 || r.statusCode === 303) {

					Transactions.add({
						customerId: req.decoded._id,
						amount: paymentParams.amount,
						currency: paymentParams.currency,
						description: paymentParams.description,
						order_id: paymentParams.order_id,
						paymentMethod: 'credit_card'
					}, function (err, transaction){
						debug('Add transaction result: ', err, transaction);
						if(err) {
							//TODO - handle the error ( 11000 for ex. )
						}
					});

					res.json({
						success: true,
						redirect: 'https://www.liqpay.com' + r.headers[locationHeader]
					});
				} else {
					res.json({
						success: false
					});
				}

			});
		}
	},

	checkoutResult: function(req, res, next){

		var params = req.body;

		var sign = liqpay.str_to_sign(liqpayPrivKey + params.data + liqpayPrivKey);

		var decodedData = new Buffer(params.data, 'base64').toString('utf8');
		
		var data = JSON.parse(decodedData);

		debug('liqpay checkoutResult: %o', params);
		debug('liqpay url: ', req.originalUrl);

		if(sign === params.signature) {
			debug('liqpay signature matched');
			debug('liqpay checkout result data: %o', data);

			Transactions.get({ customerId: req.query.id, order_id: data.order_id }, function (err, transactions){
				debug('Add transaction result: ', err, transaction);
				if(err) {
					//TODO - handle the error
				} else {
					var transaction = transactions[0];
					if(transaction.status !== data.status && (data.status === 'success' || data.status === 'sandbox')){
						CustomersService.updateBalance(req.query.id, data.amount, function (err, customer){
							debug('Update customer balance: ', err, customer.balance);
							if(err) {
								//TODO - handle the error
							} else {
								if(req.query.order) {
									debug('order: ', req.query.order);
									// var subParams = decodeURIComponent(req.query.sub);
									var order = new Buffer(req.query.order, "base64").toString();
									
									var parsedOrderParams = JSON.parse(order);

									// parsedOrderParams.customerId = req.query.id;

									debug('checkoutResult sub params: ', parsedOrderParams);

									methods.handleOrder(req.query.id, parsedOrderParams, function (err){
										if(err) {
											//TODO - handle the error
											debug('handleOrder error: ', err);
											return;
										}
										//TODO - log the event
										debug('Order handled!');
									});
								}

								transaction.status = data.status;
								transaction.balance = customer.balance;
								transaction.transaction_id = data.transaction_id;
								transaction.payment_id = data.payment_id;
								transaction.liqpay_order_id = data.liqpay_order_id;
								transaction.save(function (err, savedTransaction){
									debug('Saved transaction: ', err, savedTransaction);
									if(err) {
										//TODO - handle the error
									}
								});

							}

						});
					}
				}
			});
		} else {
			debug('liqpay signature not matched!'); //TODO - log the error
			debug('signature: %s', signature);
			debug('data: %s', decodedData);
		}

		res.end('OK');

	},

	handleOrder: function(customerId, order, callback){

		//remove this line to handle multiple orders
		if(order.length > 1) return callback('INVALID_ACTION');

		async.each(order, function (item, cb){

			item.data.customerId = customerId;

			debug('handleOrder params: %o', item);

			if(item.action === 'renewSubscription') {
				SubscriptionsService.renewSubscription(item.data, function (err, result){
					if(err) {
						//TODO - log the error
						debug('renewSubscription error: ', err);
						return cb(err);
					}
					cb();
				});
			} else if(item.action === 'createSubscription') {

				SubscriptionsService.createSubscription(item.data, function (err, branchId){
					if(err) {
						//TODO - handle the error
						debug('handleOrder error: ', err);
						return cb(err);
					}
					cb();
				});

			} else if(item.action === 'changePlan') {

				SubscriptionsService.changePlan({ customerId: customerId, oid: item.data.oid, planId: item.data.planId }, function (err, subscription){
					if(err) {
						//TODO - handle the error
						debug('handleOrder error: ', err);
						return cb(err);
					}
					cb();
				});
			} else {
				cb('INVALID_ACTION');
			}
		}, function (err){
			if(err) {
				return callback(err);
			} else {
				callback();
				//TODO - log the event
			}
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
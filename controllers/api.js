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

	/**
	 * Add credits for customer account
	 * branch on payment success
	 * @params  {object} amount, customer id
	 * @return {object} operation result
	 */
	checkout: function(req, res, next){

		var params = req.body;
		debug('checkout params: ', params);
		if(params.paymentMethod === 0) {
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
			var resultUrl = config.liqpay.resultUrl;
			var serverUrl = config.liqpay.serverUrl;
			
			serverUrl += '?id='+req.decoded._id;

			// if(params.order.length) {
			// 	serverUrl += '&order=';
			// 	// serverUrl += encodeURIComponent(new Buffer(JSON.stringify(params.sub)).toString('base64'));
			// 	serverUrl += new Buffer(JSON.stringify(params.order)).toString('base64');
			// 	// serverUrl += new Buffer(params.order).toString('base64');
			// }
			var order_id = moment().unix().toString();
			var paymentParams = {
				version: 3,
				action: 'pay',
				// amount: 1,
				amount: parseFloat(params.amount),
				public_key: liqpayPubKey,
				currency: req.decoded.currency,
				description: (params.order.length ? params.order[0].description : 'Ringotel Service Payment'),
				order_id: order_id,
				server_url: serverUrl,
				result_url: resultUrl,
				language: req.decoded.lang || 'en'
				// sandbox: 1
			};

			debug('liqpay params: ', paymentParams);

			var signature = liqpay.cnb_signature(paymentParams);
			var data = new Buffer(JSON.stringify(paymentParams)).toString('base64');

			debug('liqpay signature: ', signature, data);

			request.post('https://www.liqpay.com/api/3/checkout', {form: {data: data, signature: signature}}, function (err, r, result){
				if(err){
					debug('liqpay error: ', err);
					return next(new Error(err));
				}

				var locationHeader = r.headers['Location'] ? 'Location' : 'location';
				
				if(r.statusCode === 302 || r.statusCode === 303) {
					var transactionParams = {
						customerId: req.decoded._id,
						amount: paymentParams.amount,
						currency: paymentParams.currency,
						description: paymentParams.description,
						order_id: paymentParams.order_id,
						paymentMethod: 'credit_card'
					};
					if(params.order.length) transactionParams.order = params.order;
					Transactions.add(transactionParams, function (err, transaction){
						debug('Add transaction result: ', err, transaction);
						if(err) {
							//TODO - handle the error ( 11000 for ex. )
							logger.error(err);
						}
					});

					res.json({
						success: true,
						redirect: r.headers[locationHeader]
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
		debug('liqpay checkoutResult: ', params, params.signature, params.data);

		var sign = liqpay.str_to_sign(liqpayPrivKey + params.data + liqpayPrivKey);

		var decodedData = new Buffer(params.data, 'base64').toString('utf8');
		
		var data = JSON.parse(decodedData);

		debug('liqpay checkoutResult data: ', data);
		debug('liqpay url: ', req.originalUrl);

		if(sign === params.signature) {
			debug('liqpay signature matched');
			debug('liqpay checkout result data: %o', data);

			Transactions.get({ customerId: req.query.id, order_id: data.order_id }, function(err, transactions){
				if(err) {
					logger.error(err);
					return next(new Error(err));
				}

				if(!transactions) return res.end('OK');

				var transaction = transactions[0];
				if(transaction.status !== data.status && (data.status === 'success' || data.status === 'sandbox')){
					CustomersService.updateBalance(req.query.id, data.amount, function (err, customer){
						debug('Update customer balance: ', err, customer.balance);
						if(err) {
							//TODO - handle the error
							logger.error(err);
						} else {
							if(transaction.order) {
								debug('order: ', transaction.order);
								// var subParams = decodeURIComponent(req.query.sub);
								// var order = new Buffer(req.query.order, "base64").toString();
								
								// var parsedOrderParams = JSON.parse(order);

								// parsedOrderParams.customerId = req.query.id;

								// debug('checkoutResult sub params: ', parsedOrderParams);

								methods.handleOrder(req.query.id, transaction.order, function (err){
									if(err) {
										//TODO - handle the error
										debug('handleOrder error: ', err);
										logger.error(err);
										return;
									}
									//TODO - log the event
									debug('Order handled!');
								});
							}
						}

						data.balance = customer.balance;

						Transactions.update(transaction, data, function (err, transaction){
							if(err) {
								//TODO - handle the error
								logger.error(err);
							} else {
								debug('Transaction updated: ', transaction.status, transaction);
							}
						});
					});

					return res.end('OK');
				}

				Transactions.update(transaction, data, function (err, transaction){
					if(err) {
						//TODO - handle the error
						logger.error(err);
					} else {
						debug('Transaction updated: ', transaction.status, transaction);
					}
				});

				res.end('OK');

			});
		} else {
			debug('liqpay signature not matched!'); //TODO - log the error
			debug('signature: %s', signature);
			debug('data: %s', decodedData);
			
			res.end('OK');

		}
	},

	handleOrder: function(customerId, order, callback){

		//remove this line to handle multiple orders
		// if(order.length > 1) return callback('INVALID_ACTION');

		var allowedActions = ['renewSubscription', 'createSubscription', 'updateSubscription', 'changePlan'];

		async.eachSeries(order, function (item, cb){

			item.data.customerId = customerId;

			debug('handleOrder params: %o', item);

			if(item.action && allowedActions.indexOf(item.action) !== -1) {
				SubscriptionsService[item.action](item.data, function(err, result) {
					if(err) {
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
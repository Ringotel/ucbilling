var SubscriptionsService = require('../services/subscriptions');
var Transactions = require('../services/transactions');
var CustomersService = require('../services/customers');
var Liqpay = require('../liqpay/index');
var async = require('async');
var moment = require('moment');
var request = require('request');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');

var config = require('../env/index');
var liqpayPubKey = config.liqpay.publickey;
var liqpayPrivKey = config.liqpay.privatekey;
var liqpay = new Liqpay(liqpayPubKey, liqpayPrivKey);

module.exports = {
	checkout: checkout,
	checkoutResult: checkoutResult
};

/**
 * Add credits for customer account
 * branch on payment success
 * @params  {object} amount, customer id
 * @return {object} operation result
 */
function checkout(req, res, next){

	var params = req.body;
	debug('checkout params: ', params);
	
	if(!params.order || !params.order.length) {
		return res.json({
			success: false,
			message: 'NO_DATA'
		});
	} else if(params.paymentMethod !== 0 && !params.amount) {
		return res.json({
			success: false,
			message: 'AMOUNT_IS_NULL'
		});
	}

	if(params.paymentMethod === 0) {
		handleOrder(req.decoded._id, params.order, function (err){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}
			res.json({
				success: true
			});
		});
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
			description: (params.order.length === 1 ? params.order[0].description : 'Ringotel Service Payment'),
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
				return res.json({
					success: false,
					message: err
				});
			}

			var locationHeader = r.headers['Location'] ? 'Location' : 'location';
			
			if(r.statusCode === 302 || r.statusCode === 303) {

				async.each(params.order, function(item, callback){
					var transactionParams = {
						customerId: req.decoded._id,
						amount: item.amount,
						currency: paymentParams.currency,
						description: item.description,
						order_id: paymentParams.order_id,
						paymentMethod: 'credit_card'
					};
					if(item.data) transactionParams.order = item.data;
					Transactions.add(transactionParams, function (err, transaction){
						debug('Add transaction result: ', err, transaction);
						if(err) {
							//TODO - handle the error ( 11000 for ex. )
							return callback(err);
						}
						callback();
					});
				}, function(err) {
					if(err) logger.error(err);
				});

				res.json({
					success: true,
					redirect: r.headers[locationHeader]
				});
			} else {
				res.json({
					success: false,
					message: 'CHECKOUT_STATUS'
				});
			}

		});
	}
}

function checkoutResult(req, res, next){

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

							handleOrder(req.query.id, transaction.order, function (err){
								if(err) {
									//TODO - handle the error
									// debug('handleOrder error: ', err);
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
}

function handleOrder(customerId, order, callback){

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

}
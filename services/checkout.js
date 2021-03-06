var config = require('../env/index');
// var SubscriptionsService = require('./subscriptions');
// var Transactions = require('./transactions');
// var CustomersService = require('./customers');
// var Liqpay = require('../liqpay/index');
var Stripe = require('stripe')(config.stripe.token);
var Big = require('big.js');
var async = require('async');
var moment = require('moment');
var request = require('request');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');

// var liqpayPubKey = config.liqpay.publickey;
// var liqpayPrivKey = config.liqpay.privatekey;
// var liqpay = new Liqpay(liqpayPubKey, liqpayPrivKey);

module.exports = { chargeAmount };

// function getStatusName(string) {
// 	var status = null;
// 	switch(string) {
// 		case 'succeeded':
// 			status = 'success';
// 			break;
// 		case 'pending':
// 			status = 'pending';
// 			break;
// 		case 'failed':
// 			status = 'failed';
// 			break;
// 	}

// 	return status || string;
// }

function chargeAmount(params) {
	debug('stripeCheckout: ', params);

	return new Promise((resolve, reject) => {

		if(!params.amount || Big(params.amount).lte(0)) 
			return reject({ name: 'EINVAL', message: 'invalid amount', amount: params.amount });

		var amount = Big(params.amount).toFixed(2);
		var stripeParams = {
			amount: Big(amount).times(100).valueOf(),
			currency: params.currency,
			description: params.description,
			receipt_email: params.email
		};

		if(params.source) {
			stripeParams.source = params.source;
		} else if(params.serviceCustomer) {
			stripeParams.customer = params.serviceCustomer;
		} else {
			return reject({ name: 'NO_PAYMENT_SOURCE', message: 'No payment source' });
		}

		Stripe.charges.create(stripeParams)
		.then(charge => {
			debug('stripeCheckout chargeAmount success: ', charge);

			// let transaction = {
			// 	chargeId: charge.id,
			// 	amount: (charge.amount / 100),
			// 	currency: charge.currency,
			// 	serviceStatus: charge.status,
			// 	status: getStatusName(charge.status)
			// };

			resolve(charge);

		}).catch(err => {
			debug('stripeCheckout chargeAmount error: ', err);
			reject(err);
		});

	});

}

// function liqpayCheckout(params, callback) {
// 	var signature, sigData, locationHeader;
// 	var paymentParams = {
// 		amount: params.amount,
// 		currency: params.amount,
// 		description: params.description,
// 		order_id: params.order_id,
// 		language: params.language,
// 		public_key: liqpayPubKey,
// 		server_url: config.liqpay.serverUrl + '?id=' + params.customerId,
// 		result_url: params.resultUrl || config.liqpay.resultUrl,
// 		paymentMethod: 'card',
// 		action: 'pay',
// 		version: 3,
// 		sandbox: 1
// 	};

// 	debug('liqpay params: ', paymentParams);

// 	signature = liqpay.cnb_signature(paymentParams);
// 	sigData = new Buffer(JSON.stringify(paymentParams)).toString('base64');

// 	// debug('liqpay signature: ', signature, sigData);

// 	request.post('https://www.liqpay.com/api/3/checkout', {form: {data: sigData, signature: signature}}, function (err, r, result){
// 		if(err) return callback(err);

// 		locationHeader = r.headers['Location'] ? 'Location' : 'location';
		
// 		if(r.statusCode === 302 || r.statusCode === 303) {

// 			callback(null, { redirect: r.headers[locationHeader] });

// 		} else {
// 			callback(null, { success: false });
// 		}

// 	});
// }

// function liqpayCheckoutResult(data, callback){

// 	CustomersService.updateBalance(data.customerId, data.amount)
// 	.then(function (customer){
// 		debug('Update customer balance: ', err, customer.balance);
		
// 		Transactions.get({ customerId: data.customerId, order_id: data.order_id }, function(err, transactions){
// 			if(err) return logger.error(err);
// 			if(!transactions.length) return;

// 			async.each(transactions, function(transaction, cb) {

// 				if(transaction.status !== data.status && (data.status === 'success' || data.status === 'sandbox')){
					
// 					if(transaction.order) {
// 						debug('transaction.order: ', transaction.order);

// 						handleOrder(customerId, transaction.order, function (err){
// 							if(err) {
// 								//TODO - handle the error
// 								// debug('handleOrder error: ', err);
// 								return logger.error(err);
// 							}
// 							//TODO - log the event
// 							debug('Order handled!');
// 						});
// 					}

// 					Transactions.update({ _id: transaction._id }, { balance: customer.balance }, function (err, transaction){
// 						if(err) logger.error('transaction update error: %o', err);
// 						else debug('Transaction updated: ', transaction.status, transaction);
// 					});

// 				}

// 				cb();

// 			}, function(err) {
// 				if(err) return callback(err);
// 				callback();
// 			});

// 		});

// 	})
// 	.catch(function(err) {
// 		if(err) return callback(err);
// 	});

// }

// function handleOrder(customerId, order, callback){

// 	//remove this line to handle multiple orders
// 	// if(order.length > 1) return callback('INVALID_ACTION');

// 	var allowedActions = ['renew', 'create', 'update', 'changePlan'];
// 	var results = [];

// 	async.eachSeries(order, function (item, cb){

// 		if(!item.data) return cb();

// 		item.data.customerId = customerId;

// 		debug('handleOrder. Customer: %s. Order item: %o', customerId, item);

// 		if(item.action && allowedActions.indexOf(item.action) !== -1) {
// 			SubscriptionsService[item.action](item.data, function(err, result) {
// 				if(err) return cb(err);
// 				results.push(result);
// 				cb();
// 			});
// 		} else {
// 			cb({ name: 'EINVAL', message: 'invalid action', action: item.action });
// 		}

// 	}, function (err){
// 		if(err) return callback(err);
// 		callback(null, results);
// 	});

// }
var CheckoutService = require('../services/checkout');
var CustomersService = require('../services/customers');
var Transactions = require('../services/transactions');
var Big = require('big.js');
var async = require('async');
var moment = require('moment');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');

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
	var paymentMethod = params.payment.method; // 'balance' - ringotel balance | 'card' - credit card
	var paymentService = params.payment.service; // liqpay|stripe
	var order_id, paymentParams, defaultMethod;
	
	debug('checkout params: ', params);
	
	if(!params.order || !params.order.length) {
		return res.json({
			success: false,
			message: 'MISSING_DATA'
		});
	} else if(!paymentMethod) {
		return res.json({
			success: false,
			message: 'MISSING_DATA'
		});
	} else if(!paymentService) {
		return res.json({
			success: false,
			message: 'MISSING_DATA'
		});
	} else if(paymentMethod !== 'balance' && !params.amount) {
		return res.json({
			success: false,
			message: 'MISSING_DATA'
		});
	} else if(typeof CheckoutService[paymentService] !== 'function') {
		return res.json({
			success: false,
			message: 'NO_SERVICE'
		});
	}

	order_id = moment().unix().toString();
	params.order.customerId = req.decoded._id;

	paymentParams = {
		customer: {},
		resultUrl: params.resultUrl,
		amount: params.amount,
		currency: params.currency || req.decoded.currency,
		description: (params.order.length > 1 ? ('Ringotel Service Payment. Order ID: '+order_id) : params.order[0].description),
		order: params.order,
		order_id: order_id,
		language: (req.decoded.lang || 'en'),
		sandbox: 1
	};

	async.waterfall([
		function(cb) {
			CustomersService.get({ _id: req.decoded._id }, function(err, customer) {
				if(err) return cb(err);
				if(!customer) return cb({ name: 'ENOENT', message: 'customer not found'});

				defaultMethod = customer.billingDetails.filter((item) => { return (item.default && item.method === paymentMethod) })[0];

				if(!defaultMethod || !defaultMethod.serviceCustomer) return cb({ name: 'ERR_MISSING_ARGS', message: 'billingDetails is undefined' });

				debug('checkout controller customer: ', customer);

				paymentParams.customer = customer;
				paymentParams.serviceParams = defaultMethod;

				cb();
			});
		},
		function(cb) {
			CheckoutService[paymentService](paymentParams, function(err, result) {
				if(err) return cb(err);
				cb(null, result);
			});
		},
		function(transaction, cb) {
			// async.each(paymentParams.order, function(item, callback){
				transaction.customerId = paymentParams.customer._id;
				transaction.description = paymentParams.description;
				transaction.order_id = paymentParams.order_id;
				transaction.payment_method = paymentMethod;
				transaction.payment_service = paymentService;
				transaction.order = paymentParams.order;
				transaction.balance_before = paymentParams.customer.balance;
				transaction.balance_after = Big(paymentParams.customer.balance).plus(paymentParams.amount);

				Transactions.add(transaction, function (err){
					if(err) logger.error('Transaction add error: %j: transaction: %j', err, transaction);
				});

				cb();
		},
		function(cb) {
			CustomersService.updateBalance(paymentParams.customer, paymentParams.amount)
			.then(function(result) {
				CheckoutService.handleOrder(paymentParams.customer._id, paymentParams.order, function (err, response){
					if(err) {
						cb({ name: 'ERR_UNFINISHED_PROCESS', message: 'order process error', order: paymentParams.order });
						// TODO: try to handle order again
					}
					cb(null, response);
				});
			})
			.catch(function(err) {
				logger.error('Error: %. Reason: %o', 'UPDATE_BALANCE_ERROR', err);
				cb({ name: 'ERR_UNFINISHED_PROCESS', message: 'update balance error', amount: paymentParams.amount });
				// TODO: try to update balance and handle order again
			});
		}

	], function(err, result) {
		if(err) return next(new Error(err));
		res.json({ success: true, result: result });

	});

}

function checkoutResult(req, res, next){

	res.end('OK');

	var params = req.body;
	debug('liqpay checkoutResult: ', params);

	var sign = liqpay.str_to_sign(liqpayPrivKey + params.data + liqpayPrivKey);

	var decodedData = new Buffer(params.data, 'base64').toString('utf8');
	
	var data = JSON.parse(decodedData);
	data.customerId = req.query.id;

	debug('liqpay checkoutResult data: ', data);
	// debug('liqpay url: ', req.originalUrl);

	if(sign === params.signature) {
		CheckoutService.liqpayCheckoutResult(data, function(err, result) {
			if(err) logger.error('liqpayCheckoutResult error: %o', err);
			logger.info('liqpayCheckoutResult: %o', result);
		});


	} else {
		debug('liqpay signature not matched!'); //TODO - log the error
		// debug('signature: %s', signature);
		// debug('data: %s', decodedData);
		
	}
}
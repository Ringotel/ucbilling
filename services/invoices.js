var Customers = require('../models/customers');
var Invoices = require('../models/invoices');
var Discounts = require('../models/discounts');
var Charges = require('../models/charges');
var CheckoutService = require('./checkout');
var async = require('async');
var debug = require('debug')('billing');
var Big = require('big.js');
var logger = require('../modules/logger').payments;
var config = require('../env/index');
var Analytics = require('analytics-node');
var analytics = new Analytics(config.segmentKey);

module.exports = { get, create, pay };

function get(query, projection) {
	var promise = Invoices.find(query)
	.sort({ createdAt: -1 });

	if(projection) promise.select(projection);

	return promise;
}

function create(params) {
	let invoice = new Invoices({
		customer: params.customer,
		subscription: params.subscription,
		currency: params.currency,
		items: params.items
	});

	return invoice.save();
}

function pay(invoice) {

	return new Promise((resolve, reject) => {

		if(!(typeof invoice !== 'function')) return reject({ name: "EINVAL", message: "invoice is not a Model" });

		logger.info('InvoicesService pay invoice: ', invoice._id, invoice.items);

		var totalAmount = Big(0),
			totalProrated = Big(0),
			creditUsed = Big(0),
			balance = Big(0),
			discount = null,
			description = "",
			customer = invoice.customer;

		async.waterfall([
			function(cb) {

				// get customer object
				
				if(typeof customer === 'function') {
					cb()
				} else {
					Customers.findOne({ _id: customer })
					.select('balance billingMethod')
					.lean().exec()
					.then(result => {
						if(!result) return cb({ name: 'ENOENT', message: 'customer not found', customer: customer });
						customer = result;
						cb();
					})
					.catch(err => cb(new Error(err)));
				}

			}, function(cb) {
				
				// get discounts
				
				Discounts.find({ customer: customer._id, expired: false })
				.then(result => {
					discount = result[0];
					cb();
				})
				.catch(err => cb(err));

			}, function(cb) {
				
				// count payment amount
				
				balance = Big(customer.balance);

				invoice.items.forEach((item, index, array) => {
					description += item.description + ((array.length > 1 && index < array.length-1) ? " - " : "");
					totalAmount = totalAmount.plus(item.amount);
					totalProrated = totalProrated.plus(item.proratedAmount || 0);
				});

				if(balance.gte(totalAmount)) {
					creditUsed = Big(totalAmount);
					totalAmount = Big(0);
				} else {
					creditUsed = balance;
					totalAmount = totalAmount.minus(balance);

					// apply discount
					
					if(totalAmount.gt(1) && discount && discount.coupon && discount.coupon.percent) {
						totalAmount = totalAmount.times(discount.coupon.percent).div(100);
					}

				}

				logger.info('count payment amount: ', totalAmount.valueOf(), totalProrated.valueOf(), creditUsed.valueOf(), balance.valueOf());

				cb();

			}, function(cb) {
				if(totalAmount.lte(0)) return cb(null, null);

				// charge customer

				let checkoutParams = {
					amount: totalAmount.valueOf(),
					description: description,
					currency: invoice.currency,
					email: customer.email
				};

				if(customer.billingMethod) {
					checkoutParams.serviceCustomer = customer.billingMethod.serviceCustomer;
				} else if(invoice.paymentSource) {
					checkoutParams.source = invoice.paymentSource;
				} else {
					return cb({ name: 'NO_PAYMENT_SOURCE', message: 'No payment source' });
				}

				CheckoutService.chargeAmount(checkoutParams)
				.then(result => cb(null, result))
				.catch(err => cb(err));

			}, function(charge, cb) {
				if(!charge) return cb(null, null);
				
				// save new charge

				let newCharge = new Charges({
					customer: customer._id,
					invoice: invoice._id,
					chargeId: charge.id,
					amount: (charge.amount / 100),
					currency: charge.currency,
					description: charge.description,
					serviceStatus: charge.status,
					status: getStatusName(charge.status)
				});

				newCharge.save()
				.then(result => cb(null, charge.id))
				.catch(err => {
					
					// don't return error because invoice is paid
					
					logger.error('payment error: save charge error: ', charge, err);
					cb(null, charge.id);
				});

			}, function(chargeId, cb) {
				
				// save invoice
				
				var invoiceParams = {
					status: 'paid',
					chargeId: chargeId,
					paidAmount: totalAmount.toFixed(2),
					creditUsed: creditUsed.valueOf()
				};

				if(discount) invoiceParams.discounts = [discount];
				
				debug('invoice.set invoiceParams: ', invoiceParams);

				invoice.set(invoiceParams);
				invoice.save()
				.then(result => cb(null, result))
				.catch(err => {
					
					// don't return error because invoice is paid
					
					logger.error('payment error: save invoice error: ', invoice, err);
					cb(null, invoice);
				});

			}, function(savedInvoice, cb) {
				
				// update customer
				
				if(creditUsed.lte(0) && totalProrated.lte(0)) return cb(null, savedInvoice);

				let newBalance = balance.plus(totalProrated).minus(savedInvoice.creditUsed).valueOf();

				logger.info('payInvoice new customer balance: ', newBalance);
				
				Customers.update({ _id: customer }, { $set: { balance: newBalance } })
				.then(() => cb(null, savedInvoice))
				.catch(err => {
					
					// don't return error because invoice is paid
					
					logger.error('payment error: customer update error: ', savedInvoice, err);
					cb(null, savedInvoice)
				});

			}

		], function(err, result) {
			if(err) {
				logger.error('payment error: ', invoice, err);
				reject(err);
			} else {
				logger.info('payment result: ', result._id, result.items);
				resolve(result);

				analytics.track({
				  userId: customer._id.toString(),
				  event: 'Invoice paid',
				  properties: {
				  	amount: result.paidAmount
				  }
				});
			}
				
		});

	});
}

function getStatusName(string) {
	var status = null;
	switch(string) {
		case 'succeeded':
			status = 'success';
			break;
		case 'pending':
			status = 'pending';
			break;
		case 'failed':
			status = 'failed';
			break;
	}

	return status || string;
}
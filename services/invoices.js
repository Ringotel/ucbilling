var Customers = require('../models/customers');
var Invoices = require('../models/invoices');
var Discounts = require('../models/discounts');
var CheckoutService = require('./checkout');
var async = require('async');
var debug = require('debug')('billing');
var Big = require('big.js');
var logger = require('../modules/logger').payments;

module.exports = { get, pay };

function get(query, projection) {
	var promise = Invoices.find(query)
	.sort({ createdAt: -1 });

	if(projection) promise.select(projection);

	return promise;
}

function pay(invoice) {

	return new Promise((resolve, reject) => {

		if(!(typeof invoice !== 'function')) return reject({ name: "EINVAL", message: "invoice is not an instanceof Model" });

		logger.info('InvoicesService pay invoice: ', invoice._id, invoice.items);

		var totalAmount = Big(0),
			totalProrated = Big(0),
			creditUsed = Big(0),
			balance = Big(0),
			discount = null,
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
				Discounts.find({ customer: customer._id, expired: false })
				.then(result => {
					discount = result[0];
					cb();
				})
				.catch(err => cb(err));

			}, function(cb) {
				// count payment amount
				balance = Big(customer.balance);

				invoice.items.forEach(item => {
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
				// charge customer
				if(totalAmount.lte(0)) return cb(null, {});

				debug('InvoicesService pay customer: ', customer);

				// serviceParams = customer.billingDetails.filter((item) => { return (item.default && item.method === 'card') })[0];
				CheckoutService.stripe({
					amount: totalAmount.valueOf(),
					currency: invoice.currency,
					serviceParams: customer.billingMethod
				})
				.then(transaction => cb(null, transaction))
				.catch(err => cb(err));

			}, function(transaction, cb) {
				// save invoice
				var invoiceParams = {
					// chargeId: transaction.chargeId,
					// paymentSource: transaction.source,
					paidAmount: totalAmount.toFixed(2),
					creditUsed: creditUsed.valueOf(),
					status: 'paid'
				};
				if(discount) invoiceParams.discounts = [discount];
				invoice.set(invoiceParams);
				invoice.save()
				.then(result => cb(null, result))
				.catch(cb);

			}, function(invoice, cb) {
				// update customer
				if(creditUsed.lte(0) && totalProrated.lte(0)) return cb(null, invoice);

				let newBalance = balance.plus(totalProrated).minus(invoice.creditUsed).valueOf();

				logger.info('payInvoice new customer balance: ', newBalance);
				
				Customers.update({ _id: customer }, { $set: { balance: newBalance } })
				.then(() => cb(null, invoice))
				.catch(err => cb(new Error(err)));

			}

		], function(err, result) {
			if(err) {
				logger.error('payment error: ', invoice, err);
				return reject({ name: "EINVAL", code: err.code, message: err.message });
			}
			logger.info('payment result: ', result._id, result.items);
			resolve(result);
		});

	});
}
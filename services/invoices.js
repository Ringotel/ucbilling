var Customers = require('../models/customers');
var CheckoutService = require('./checkout');
var async = require('async');
var debug = require('debug')('billing');
var Big = require('big.js');
var logger = require('../modules/logger').api;

module.exports = { pay };

function pay(invoice) {

	return new Promise((resolve, reject) => {

		if(!(typeof invoice !== 'function')) return reject({ name: "EINVAL", message: "invoice is not instanceof Model" });

		debug('InvoicesService pay invoice: ', invoice);

		var totalAmount = Big(0),
			totalProrated = Big(0),
			creditUsed = Big(0),
			balance = Big(0),
			customer = invoice.customer;

		async.waterfall([
			function(cb) {
				// get customer object
				if(typeof customer === 'function') {
					cb(null, customer)
				} else {
					Customers.findOne({ _id: customer })
					.select('balance billingDetails')
					.lean().exec()
					.then(result => {
						customer = result;
						cb(null, customer);
					})
					.catch(err => cb(new Error(err)));
				}

			}, function(customer, cb) {
				// count payment amount
				balance = Big(customer.balance);

				invoice.items.forEach(item => {
					totalAmount = totalAmount.plus(item.amount);
					totalProrated = totalProrated.plus(item.proratedAmount || 0);
				});

				// totalAmount = totalAmount.minus(totalProrated);

				if(balance.gte(totalAmount)) {
					creditUsed = Big(totalAmount);
					totalAmount = Big(0);
				} else {
					totalAmount = totalAmount.minus(balance);
					creditUsed = balance;
				}

				debug('count payment amount: ', totalAmount.valueOf(), totalProrated.valueOf(), creditUsed.valueOf(), balance.valueOf());

				cb();

			}, function(cb) {
				// charge customer
				if(totalAmount.lte(0)) return cb(null, {});

				serviceParams = customer.billingDetails.filter((item) => { return (item.default && item.method === 'card') })[0];
				CheckoutService.stripe({
					amount: totalAmount.valueOf(),
					currency: invoice.currency,
					serviceParams: serviceParams
				})
				.then(transaction => cb(null, transaction))
				.catch(err => cb(err));

			}, function(transaction, cb) {
				// save invoice
				invoice.set({
					chargeId: transaction.chargeId,
					paymentSource: transaction.source,
					creditUsed: creditUsed.valueOf(),
					status: 'paid'
				});

				cb(null, invoice);

			}, function(invoice, cb) {
				// update customer
				if(creditUsed.lte(0) && totalProrated.lte(0)) return cb(null, invoice);

				let newBalance = balance.plus(totalProrated).minus(invoice.creditUsed).valueOf();

				debug('payInvoice new customer balance: ', newBalance);
				
				Customers.update({ _id: customer }, { $set: { balance: newBalance } })
				.then(() => cb(null, invoice))
				.catch(err => cb(new Error(err)));

			}

		], function(err, result) {
			if(err) return reject(err);
			resolve(result);
		});

	});
}
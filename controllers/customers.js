var config = require('../env/index');
var Invoices = require('../models/invoices');
var CustomersService = require('../services/customers');
var InvoicesService = require('../services/invoices');
var utils = require('../lib/utils');
var async = require('async');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');
var shortid = require('shortid');
var Stripe = require('stripe')(config.stripe.token);
var Analytics = require('analytics-node');
var analytics = new Analytics(config.segmentKey);

module.exports = {

	get: function(req, res, next) {
		CustomersService.get({ _id: req.decoded.customerId }, '-_id -login -password')
		.then((result) => {
			if(!result) return res.json({ success: false })

			res.json({
				success: true,
				result: result
			});
		})
		.catch(err => {
			if(err) return next(new Error(err));
		});
	},

	update: function(req, res, next){
		debug('Customer controller - update: ', req.body);

		CustomersService.update({_id: req.decoded._id}, req.body, function(err, updatedCustomer){
			if(err) return next(new Error(err));
			if(!updatedCustomer) return res.json({ success: false });

			res.json({ success: true });

		});

	},

	addCard: function(req, res, next) {
		var params = req.body;
		var customer = {};

		if(!params.token) return res.json({ error: { message: 'MISSING_DATA' } });

		CustomersService.get({ _id: req.decoded.customerId })
		.then(result => {
			if(!result) return Promise.reject();

			customer = result;

			// Add stripe customer
			return Stripe.customers.create({
			  email: customer.email,
			  source: params.token
			});
		})
		.then(stripeCustomer => {
			debug('addCard customer: ', stripeCustomer);
			if(!stripeCustomer) {
				logger.error('Stripe customer is not created. Customer: %o. Params: %o', customer, params);
				return Promise.reject();
			}

			return CustomersService.addBillingMethod(customer, {
				method: "card",
				service: "stripe",
				default: true,
				serviceCustomer: stripeCustomer.id,
				params: {
					id: params.card.id,
					brand: params.card.brand,
					address_zip: params.card.address_zip,
					exp_month: params.card.exp_month,
					exp_year: params.card.exp_year,
					last4: params.card.last4
				}
			})
		})
		.then(result => {
			res.json({ success: true });

			analytics.track({
			  userId: customer._id.toString(),
			  event: 'Credit Card Added'
			});
		})
		.catch(err => {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		});

	},

	updateCard: function(req, res, next) {
		var params = req.body;
		var defaultMethod;
		var customer = {};
		
		debug('updateCard: ', params);

		if(!params.card) return res.json({ success: false, error: { error: { message: 'MISSING_DATA_CARD' } } });

		CustomersService.get({ _id: req.decoded.customerId })
		.then(result => {
			if(!result) return Promise.reject();

			customer = result;

			// defaultMethod = customer.billingDetails.filter((item) => { return item.default })[0];
			defaultMethod = customer.billingMethod;
			if(!defaultMethod || !defaultMethod.serviceCustomer) 
				return Promise.reject({ error: { message: 'MISSING_DATA' } });

			// Add stripe customer
			return Stripe.customers.createSource(defaultMethod.serviceCustomer, {
			  source: params.token
			});
		})
		.then(newSource => {
				debug('updateCard newSource: ', newSource);
				return Stripe.customers.update(defaultMethod.serviceCustomer, {
				  default_source: newSource.id
				});
		}).then(stripeCustomer => {
			return CustomersService.addBillingMethod(customer, {
				method: "card",
				service: "stripe",
				default: true,
				serviceCustomer: stripeCustomer.id,
				params: {
					id: params.card.id,
					brand: params.card.brand,
					address_zip: params.card.address_zip,
					exp_month: params.card.exp_month,
					exp_year: params.card.exp_year,
					last4: params.card.last4
				}
			});
		})
		.then(result => {
			res.json({ success: true }); 

			analytics.track({
			  userId: customer._id.toString(),
			  event: 'Credit Card Updated'
			});
		}).catch(err => {
			debug('updateCard catch: ', err);
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		});

	},

	setCustomerLang: function(req, res, next){
		var params = req.body;
		CustomersService.update({ _id: params.customerId }, { lang: params.lang }, function (err){
			if(err) {
				return res.json({
					success: false,
					error: err
				});
			}
			res.json({
				success: true
			});
		});
	},

	updateBalance: function(req, res, next) {
		var params = req.body;
		var customer = {};

		debug('updateBalance params: ', params);

		CustomersService.get({ _id: params.customerId })
		.then(result => {
			if(!result) return Promise.reject();

			customer = result;

			debug('updateBalance customer: ', customer);

			let invoice = new Invoices({
				customer: customer,
				currency: params.currency,
				items: [{
					description: params.description,
					amount: params.amount
				}]
			});

			if(params.token) {
				invoice.paymentSource = params.token;
			}

			debug('updateBalance controller - pay invoice: ', invoice.paymentSource);

			return InvoicesService.pay(invoice);
		})
		.then(invoice => {
			debug('updateBalance controller: updateBalance: ', invoice.paidAmount);
			return CustomersService.updateBalance(customer, invoice.paidAmount);
		})
		.then(result => {
			res.json({ success: true });
		})
		.catch(err => {
			if(err instanceof Error) return next(err);
			res.json({ success: false, error: err });
		});

	},

	getCustomerBalance: function(req, res, next){
		CustomersService.getCustomerBalance({_id: req.decoded.customerId}, function(err, balance){
			if(err) {
				return res.json({
					success: false,
					error: err
				});
			}

			res.json({
				success: true,
				result: balance
			});
		});
	}

};
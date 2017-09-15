var config = require('../env/index');
var CustomersService = require('../services/customers');
var utils = require('../lib/utils');
var async = require('async');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');
var shortid = require('shortid');
var Stripe = require('stripe')(config.stripe.token);

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
		})
		.catch(err => {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, result: err });
		});

	},

	updateCard: function(req, res, next) {
		var params = req.body;
		var defaultMethod;
		var customer = {};
		
		debug('updateCard: ', params);

		if(!params.card) return res.json({ success: false, result: { error: { message: 'MISSING_DATA_CARD' } } });

		CustomersService.get({ _id: req.decoded.customerId })
		.then(result => {
			if(!result) return Promise.reject();

			customer = result;

			defaultMethod = customer.billingDetails.filter((item) => { return item.default })[0];
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
		}).catch(err => {
			debug('updateCard catch: ', err);
			if(err instanceof Error) return next(err);
			return res.json({ success: false, result: err });
		});

	},

	setCustomerLang: function(req, res, next){
		var params = req.body;
		CustomersService.update({ _id: params.customerId }, { lang: params.lang }, function (err){
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
	},

	getCustomerBalance: function(req, res, next){
		CustomersService.getCustomerBalance({_id: req.decoded.customerId}, function(err, balance){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: balance
			});
		});
	}

};
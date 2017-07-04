var Customers = require('../models/customers');
var CustomersService = require('../services/customers');
var utils = require('../lib/utils');
var debug = require('debug')('billing');

module.exports = {

	isExistedCustomer: function(req, res, next) {
		var params = req.body;

		CustomersService.get({ email: params.email }, function(err, result) {
			if(err) return next(new Error(err));
			return !!result;
		});
	},

	get: function(req, res, next) {
		CustomersService.get({ _id: req.decoded._id }, '-_id -login -password', function(err, result) {
			if(err) return next(new Error(err));
			if(!result) return res.json({ success: false, message: 'USER_NOT_FOUND' })

			res.json({
				success: true,
				result: result
			});
		});
	},

	update: function(req, res, next){
		// if(req.decoded._id !== req.params.id){
		// 	return res.json({
		// 		success: false,
		// 		message: 'User parameters not matched'
		// 	});
		// }
		debug('Customer controller - update: ', req.body);

		CustomersService.update({_id: req.decoded._id}, req.body, function(err, updatedCustomer){
			if(err) return next(new Error(err));
			if(!updatedCustomer) {
				return res.json({
					success: false,
					message: 'User parameters not matched'
				});
			}

			res.json({
				success: true
			});

		});

		// Customers.findOne({_id: req.params.id}, function(err, customer){
		// 	if(err){
		// 		next(new Error(err));
		// 	} else {
		// 		if(!customer){
		// 			next(new Error('User not found'));
		// 			return;
		// 		}

		// 		if(params.email) customer.email = params.email;
		// 		if(params.name) customer.name = params.name;
		// 		if(params.password) customer.password = params.password;
		// 		customer.save(function(err, customer){
		// 			debug('new customer params: ', customer);
		// 			if(err){
		// 				next(new Error(err));
		// 			} else {
		// 				customer.password = '';
		// 				res.json({
		// 					success: true,
		// 					result: customer
		// 				});
		// 			}
		// 		});
		// 	}
		// });
	},

	// get: function(req, res, next){
	// 	var params = req.body;
	// 	Customers.findOne({_id: req.params.id}, function(err, customer){
	// 		if(err){
	// 			next(new Error(err));
	// 		} else {
	// 			res.json({
	// 				success: true,
	// 				result: customer
	// 			});
	// 		}
	// 	});
	// },

	remove: function(req, res, next){
		var params = req.body;
		CustomersService.remove({_id: req.params.id}, function(err){
			if(err){
				return res.json({
					success: false,
					message: err
				});
			} else {
				res.json({
					success: true
				});
			}
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
		CustomersService.getCustomerBalance({_id: req.decoded._id}, function(err, balance){
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
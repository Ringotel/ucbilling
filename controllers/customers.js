var Customers = require('../models/customers');
var CustomersService = require('../services/customers');
var utils = require('../lib/utils');
var debug = require('debug')('billing');

module.exports = {

	// create: function(req, res, next){
	// 	var params = req.body;
	// 	// params.created = Date.now();
	// 	var newCustomer = new Customers(params);
	// 	newCustomer.save(function(err, customer){
	// 		if(err){
	// 			next(new Error(err));
	// 		} else {
	// 			res.json({success: true, result: customer.id});
	// 		}
	// 	});
	// },

	update: function(req, res, next){
		var params = req.body;
		if(req.decoded._id !== req.params.id){
			return res.json({
				success: false,
				message: 'User parameters not matched'
			});
		}

		CustomersService.update({_id: req.params.id}, params, function(err, updatedCustomer){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			updatedCustomer.password = '***************';
			res.json({
				success: true,
				result: updatedCustomer
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
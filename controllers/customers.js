var Customers = require('../models/customers');
var CustomersService = require('../services/customers');
var bcrypt = require('bcrypt');
var utils = require('../lib/utils');
var debug = require('debug')('billing');

var isValidPassword = function(password, hash, cb){
    bcrypt.compare(password, hash, function(err, isMatch){
        if(err) throw err;
        cb(isMatch);
    });
};

module.exports = {

	create: function(req, res, next){
		var params = req.body;
		console.log('customer params: ', params);
		// params.created = Date.now();
		var newCustomer = new Customers(params);
		newCustomer.save(function(err, customer){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, result: customer.id});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		if(req.decoded._id !== req.params.id){
			next(new Error('User parameters not matched'));
			return;
		}
		Customers.findOne({_id: req.params.id}, function(err, customer){
			if(err){
				next(new Error(err));
			} else {
				if(!customer){
					next(new Error('User not found'));
					return;
				}
				debug('prev customer params: ', customer);

				if(params.email) customer.email = params.email;
				if(params.name) customer.name = params.name;
				if(params.password) customer.password = params.password; //TODO - hash password
				customer.save(function(err, customer){
					debug('new customer params: ', customer);
					if(err){
						next(new Error(err));
					} else {
						customer.password = '';
						res.json({
							success: true,
							result: customer
						});
					}
				});
			}
		});
	},

	get: function(req, res, next){
		var params = req.body;
		Customers.findOne({_id: req.params.id}, function(err, customer){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: customer
				});
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body;
		Customers.remove({_id: req.params.id}, function(err){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
			}
		});
	},

	setCustomerLang: function(req, res, next){
		var params = req.body;
		debug('setCustomerLang params: ', params);
		CustomersService.update({ customerId: params.customerId }, { lang: params.lang }, function (err){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: 'OK'
			});
		});
	},

	getCustomerBalance: function(req, res, next){
		Customers.findOne({_id: req.decoded._id}).select('balance').exec(function (err, result){
			if(err) {
				return next(new Error(err));
			}
			debug('Customer balance: ', result.balance);
			res.json({
				success: true,
				result: result.balance
			});
		});
	}

};
var Customers = require('../models/customers');
var Big = require('big.js');
var debug = require('debug')('billing');

var methods = {

	isEnoughCredits: function(customerId, amount, callback){
		Customers.findOne({_id: customerId}).select('balance').exec(function (err, result){
			if(err) {
				return callback(err);
			}
			return callback( null, (Big(result.balance).gte(amount)) );
		});
	},

	exist: function(customerId, callback) {
		Customers.count({ _id: customerId })
		.then(result => callback(null, !!result))
		.catch(err => callback(err));
	},

	getCustomerBalance: function(query, callback) {
		Customers.findOne(query).select('balance').exec(function (err, result){
			if(err) return callback(err)
			callback(null, result.balance)
		});
	},

	get: function(params, projection){
		var promise = Customers.findOne(params);
		if(projection) promise.select(projection);
		return promise.exec();
	},

	create: function(params, callback) {
		
		new Customers(params)
		.save(function (err, customer){
			if(err) return callback(err);
			
			callback(null, customer);
			
		});
	},

	update: function(query, params, callback){

		Customers.findOne(query, function(err, customer){
			if(err) return callback(err);
			if(!customer) return callback();

			if(params.email) customer.email = params.email;
			if(params.name) customer.name = params.name;
			if(params.password) customer.password = params.password;

			customer.save(function(err, updatedCustomer){
				debug('Customers service - update: ', updatedCustomer);
				if(err) return callback(err);
				callback(null, updatedCustomer);
			});
		});
	},

	updateBalance: function(customer, amount){
		var promise = (typeof customer === 'function') ? 
				( new Promise((resolve, reject) => { resolve(customer); }) ) : 
				Customers.findOne({ _id: customer });

		return promise.then(function(customer) {
			customer.balance = Big(customer.balance).plus(amount);
			return customer.save();
		});
	},

	addBillingMethod: function(customer, params) {
		debug('Customers service - addBillingMethod: ', params);
		var promise = (typeof customer === 'function') ? 
				Promise.resolve(customer) : 
				Customers.findOne({ _id: customer });

		return promise
		.then(function(customer) {
			if(params.default) {
				// change default method
				customer.billingDetails = customer.billingDetails.map((item) => {
					item.default = false;
					return item;
				});
			}

			customer.billingDetails.push(params);
			return customer.save();
		});
	}

};

module.exports = methods;
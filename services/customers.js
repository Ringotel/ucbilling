var Customers = require('../models/customers');
var debug = require('debug')('billing');

var methods = {

	isEnoughCredits: function(customerId, amount, callback){
		// if customerId is already a customer object
		// if(typeof customerId === 'object' && customerId.balance !== undefined) {
		// 	return callback( null, (parseFloat(customerId.balance) >= parseFloat(amount)) );
		// } else {
			Customers.findOne({_id: customerId}).select('balance').exec(function (err, result){
				if(err) {
					return callback(err);
				}
				return callback( null, (parseFloat(result.balance) >= parseFloat(amount)) );
			});
		// }
	},

	getCustomerBalance: function(query, callback) {
		Customers.findOne(query).select('balance').exec(function (err, result){
			if(err) return callback(err)
			callback(null, result.balance)
		});
	},

	get: function(params, projection, callback){
		var proj = (typeof projection === 'function') ? null : projection,
			cb = proj ? callback : projection;

		Customers.findOne(params, proj, function(err, customer){
			if(err) return cb(err);
			cb(null, customer);
		});
	},

	createPromise: function(params){
		return new Customers(params).save();
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

	updateBalance: function(customerId, amount, callback){
		Customers.findOne({ _id: customerId }, function (err, customer){
			if(err) {
				return callback(err);
			}
			customer.balance = parseFloat(customer.balance) + amount;
			customer.save(function (err, updatedCustomer){
				if(err) {
					return cd(err);
				}
				callback(null, updatedCustomer);
			});
		});
	},

	remove: function(query, callback) {
		Customers.remove(query, function(err){
			if(err) return callback(err);
			callback();
		});
	}

};

module.exports = methods;
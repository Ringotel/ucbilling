var Customers = require('../models/customers');
var debug = require('debug')('billing');

var methods = {

	isEnoughCredits: function(customerId, amount, callback){
		Customers.findOne({_id: customerId}).select('balance').exec(function (err, result){
			if(err) {
				return callback(err);
			}
			return callback( null, (parseFloat(result.balance) >= parseFloat(amount)) );
		});
	},

	createPromise: function(params){
		return new Customers(params).save();
	},

	update: function(query, params, callback){
		Customers.update(query, params, function (err){
			if(err) return callback(err);
			callback();
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
	}

};

module.exports = methods;
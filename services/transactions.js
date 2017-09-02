var Transactions = require('../models/transactions');
var debug = require('debug')('billing');
var async = require('async');
var logger = require('../modules/logger').transactions;

var methods = {

	add: function(params, callback){
		var newTransaction = new Transactions(params);
		var propmise = newTransaction.save();

		if(!callback) return propmise;

		propmise.then(transaction => callback(null, transaction))
		.catch(err => callback(err));
	},
	get: function(query, limit){
		var promise = Transactions.find(query).sort('-createdAt');
		if(limit) promise.limit(limit);
		return promise;
	},
	update: function(query, data, callback){

		Transactions.update(query, { $set: data }, function(err) {
			if(err) return callback(err);
			callback();
		});
		
	}
};

module.exports = methods;
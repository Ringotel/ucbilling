var Transaction = require('../models/transactions');

var methods = {

	add: function(params, callback){
		var newTransaction = new Transaction(params);
		newTransaction.save(function (err, transaction){
			if(err){
				return callback(err);
			}
			callback(null, transaction);
		});
	},
	get: function(query, limit, callback){
		Transaction.find(query).sort('-createdAt').limit(limit).exec(function (err, transactions){
			if(err){
				callback(err);
			} else {
				callback(null, transactions);
			}
		});
	}
};

module.exports = methods;
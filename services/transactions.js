var Transaction = require('../models/transactions');

var methods = {
	// getAll: function(query, callback){
	// 	Transaction.find(query, function (err, result){
	// 		if(err){
	// 			callback(err);
	// 		} else {
	// 			callback(null, result);
	// 		}
	// 	});
	// },
	add: function(params, callback){
		// var params = req.body;

		var newTransaction = new Transaction(params);
		newTransaction.save(function (err, transaction){
			if(err){
				return callback(err);
			}
			callback(null, transaction);
		});
	},
	get: function(query, callback){
		Transaction.find(query).sort('-createdAt').exec(function (err, transactions){
			if(err){
				callback(err);
			} else {
				callback(null, transactions);
			}
		});
	}
};

module.exports = methods;
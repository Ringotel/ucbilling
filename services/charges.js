var Charges = require('../models/charges');
var debug = require('debug')('billing');

var methods = {
	
	add: function(params, callback){
		var newCharge = new Charges(params);
		newCharge.save(function (err, charge){
			if(err){
				return callback(err);
			}
			callback(null, charge);
		});
	},
	get: function(query, limit, callback){
		debug('charges service query: ', query);
		Charges.aggregate([
			{
				$match: query
			},
			{
				$sort: {
					createdAt: -1
				}
			},
			{
				$group: {
					_id: "$_subscription",
					description: { $last: '$description' },
					amount: { $push: "$amount" },
					balance: { $push: "$balance" },
					prevBalance: { $push: "$prevBalance" },
					startBalance: { $last: "$prevBalance" },
					endBalance: { $first: "$balance" },
					from: { $min: "$createdAt" },
					to: { $max:  "$createdAt"}
				}
			},
			{
				$sort: {
					to: -1
				}
			},
		], function(err, result) {
			if(err) {
				return callback(err);
			}
			callback(null, result);
		});
	}
};

module.exports = methods;
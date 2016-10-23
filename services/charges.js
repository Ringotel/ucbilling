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
					updatedAt: -1
				}
			},
			// {
			// 	$lookup: {
			// 		from: "subscriptions",
			// 		localField: "_subscription",
			// 		foreignField: "_id",
			// 		as: "_subscription"
			// 	}
			// },
			// {
			// 	$unwind: "$_subscription"
			// },
			{
				$group: {
					_id: "$_subscription",
					description: { $last: '$description' },
					amount: { $push: "$amount" },
					balance: { $push: "$balance" },
					prevBalance: { $push: "$prevBalance" },
					startBalance: { $last: "$prevBalance" },
					endBalance: { $first: "$balance" },
					from: { $min: "$updatedAt" },
					to: { $max:  "$updatedAt"}
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

		// var promise = Charges.find(query).populate('_subscription').sort('-createdAt'),
		// 	cb = null;

		// if(typeof limit !== 'function') {
		// 	promise.limit(limit);
		// 	cb = callback;
		// } else {
		// 	cb = limit;
		// }
		// promise.exec(function (err, charges){
		// 	if(err){
		// 		cb(err);
		// 	} else {
		// 		cb(null, charges);
		// 	}
		// });
	}
};

module.exports = methods;
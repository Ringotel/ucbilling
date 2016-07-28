var Charges = require('../models/charges');

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
		var promise = Charges.find(query).sort('-createdAt'),
			cb = null;

		if(typeof limit !== 'function') {
			promise.limit(limit);
			cb = callback;
		} else {
			cb = limit;
		}
		promise.exec(function (err, charges){
			if(err){
				cb(err);
			} else {
				cb(null, charges);
			}
		});
	}
};

module.exports = methods;
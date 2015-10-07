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
		Charges.find(query).sort('-createdAt').limit(limit).exec(function (err, charges){
			if(err){
				callback(err);
			} else {
				callback(null, charges);
			}
		});
	}
};

module.exports = methods;
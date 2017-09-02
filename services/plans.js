var Plans = require('../models/plans');

var methods = {
	get: function(params, projection, callback){
		var query = Plans.find(params);
		if(projection) query.select(projection);
		query.exec(function (err, result){
			if(err) return callback(err);
			callback(null, result);
		});
	},
	getOne: function(params, projection, callback){
		var query = Plans.findOne(params);
		if(projection) query.select(projection);
		query.exec(function (err, result){
			if(err) return callback(err);
			callback(null, result);
		});
	}
};

module.exports = methods;
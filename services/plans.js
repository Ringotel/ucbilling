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
	getPromise: function(params, projection){
		var query = Plans.find(params);
		if(projection) query.select(projection);
		return query.exec();
	}
};

module.exports = methods;
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
	},
	getPromise: function(params, projection){
		var query = Plans.find(params);
		if(projection) query.select(projection);
		return query.exec();
	},

	// get all active plans
	getAll: function(req, res, next){
		Plans.find({ _state: 1 }, function(err, array){
			if(err){
				next(new Error(err));
			} else {
				res.json(array);
			}
		});
	},

	getRequest: function(req, res, next){
		methods.get({_id: req.params.id}, function(err, plan){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: plan
				});
			}
		});
	}

	// get: function(query, cb){
	// 	Plans.findOne(query).lean().exec(function(err, plan){
	// 		if(err){
	// 			cb(err);
	// 		} else {
	// 			cb(null, plan);
	// 		}
	// 	});
	// }
};

module.exports = methods;
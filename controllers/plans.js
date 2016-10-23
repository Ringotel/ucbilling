var Plans = require('../models/plans');

var methods = {
	
	getAll: function(req, res, next){
		Plans.find({}, function(err, array){
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
	},

	get: function(query, cb){
		Plans.findOne(query).lean().exec(function(err, plan){
			if(err){
				cb(err);
			} else {
				cb(null, plan);
			}
		});
	}

};

module.exports = methods;

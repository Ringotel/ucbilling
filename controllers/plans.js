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

	add: function(req, res, next){
		var params = req.body;

		if(params.customData) {
			params.customData = JSON.parse(params.customData);
		}

		var newPlan = new Plans(params);

		newPlan.save(function(err, plan){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, result: plan});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;

		if(params.customData) {
			params.customData = JSON.parse(params.customData);
		}

		Plans.update({_id: req.params.id}, params, function(err, data){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
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
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Plans.remove({_id: req.params.id}, function(err){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
			}
		});
	}

};

module.exports = methods;

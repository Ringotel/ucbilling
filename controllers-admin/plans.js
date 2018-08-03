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

		if(params.attributes) {
			params.attributes = JSON.parse(params.attributes);
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

		if(params.attributes) {
			params.attributes = JSON.parse(params.attributes);
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

	getById: function(req, res, next){
		Plans.findById({_id: req.params.id}, function(err, plan){
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

	deleteById: function(req, res, next){
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

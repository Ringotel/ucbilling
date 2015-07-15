var Plans = require('../models/plans');

module.exports = {
	
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
		var newPlan = new Plans(params);

		newPlan.save(function(err, plan){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, plan: plan});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		Plans.update({id: req.params.id}, params, function(err, data){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
			}
		});
	},

	get: function(query, cb){
		Plans.findOne(query, '-_id -__v -updatedAt -createdAt -description').lean().exec(function(err, plan){
			if(err){
				cb(err);
			} else {
				cb(null, plan);
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Plans.remove({id: req.params.id}, function(err){
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
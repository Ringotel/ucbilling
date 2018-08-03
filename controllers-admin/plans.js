var PlansService = require('../services/plans');

var methods = {
	
	getAll: function(req, res, next){
		PlansService.getAll({}, null)
		.then(result => {
			res.json({ success: true, result: result });
		})
		.catch(err => next(err));
	},

	getById: function(req, res, next){
		PlansService.get({_id: req.params.id}, null, function(err, plan){
			if(err){
				next(err);
			} else {
				res.json({
					success: true,
					result: plan
				});
			}
		});
	},

	add: function(req, res, next){
		var params = req.body;

		if(params.attributes) {
			params.attributes = JSON.parse(params.attributes);
		}

		PlansService.add(params)
		.then(result => {
			res.json({success: true, result: result});
		})
		.catch(err => next(err));
	},

	update: function(req, res, next){
		var params = req.body;

		PlansService.update({_id: req.params.id}, params)
		.then(() => {
			res.json({ success: true })
		})
		.catch(err => next(err));

	},

	deleteById: function(req, res, next){
		var params = req.body.params;
		Plans.remove({_id: req.params.id})
		.then(() => { res.json({ success: true }) })
		.catch(err => next(err));
	}

};

module.exports = methods;

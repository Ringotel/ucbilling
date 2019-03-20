var PlansService = require('../services/plans');

var methods = {
	
	getPlans: function(req, res, next){
		var params = req.body;
		var currency = req.decoded.currency || req.body.currency;
		var query = { currency: currency, _state: '1' };
		var restrictedRoles = ["branchAdmin", "user"];

		// Don't return 'trial' to users with restricted roles
		// if(restrictedRoles.indexOf(req.decoded.role) !== -1) query.planId = { $ne: 'trial' };

		PlansService.get(query, '-__v -updatedAt -createdAt -_state', function (err, result){
			if(err) return next(err);			
			res.json({
				success: true,
				result: result
			});
		});
	},

	getCustomPlans: function(req, res, next) {
		var params = req.body;
		var partnerId = params.partnerId;

		if(!partnerId) return next(new Error({ message: 'MISSING_DATA' }));

		PlansService.get({ createBy: partnerId }, '-__v -updatedAt -createdAt', function (err, result){
			if(err) return next(err);			
			res.json({
				success: true,
				result: result
			});
		});	
	},

	create: function(req, res, next) {

	},

	update: function(req, res, next) {

	}

};

module.exports = methods;

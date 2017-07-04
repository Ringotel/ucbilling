var PlansService = require('../services/plans');

var methods = {
	
	getPlans: function(req, res, next){
		var params = req.body;
		var currency = req.decoded.currency || req.body.currency;
		var query = { currency: currency, _state: '1' };
		var restrictedRoles = ["branchAdmin", "user"];

		// Don't return 'trial' to users with restricted roles
		if(restrictedRoles.indexOf(req.decoded.role) !== -1) query.planId = { $ne: 'trial' };

		PlansService.get(query, '-updatedAt -createdAt -_state', function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}
			res.json({
				success: true,
				result: result
			});
		});
	}

};

module.exports = methods;

var Discount = require('../models/discounts');

module.exports = {
	
	getAll: function(req, res, next){
		Discount.find({}, function(err, array){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: array
				});
			}
		});
	},

	get: function(req, res, next){
		Discount.findOne({_id: req.params.id}, function(err, discount){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: discount
				});
			}
		});
	}

};
var Discount = require('../models/discounts');

module.exports = {
	
	getAll: function(req, res, next){
		Discount.find({}, function(err, array){
			if(err){
				next(new Error(err));
			} else {
				res.json(array);
			}
		});
	},

	add: function(req, res, next){
		var params = req.body;
		// params.created = Date.now();
		// params.id = params.created;

		var newDiscount = new Discount(params);
		newDiscount.save(function(err, discount){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, result: discount});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		console.log('update addon', params);
		Discount.update({_id: req.params.id}, params, function(err, data){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
			}
		});
	},

	get: function(req, res, next){
		// var params = req.body.params;
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
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Discount.remove({_id: req.params.id}, function(err){
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
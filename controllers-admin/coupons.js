var Coupon = require('../models/coupons');

module.exports = {
	
	getAll: function(req, res, next){
		Coupon.find({}, function(err, array){
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

		var newCoupon = new Coupon(params);
		newCoupon.save(function(err, discount){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, result: discount});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		console.log('update Coupon', params);
		Coupon.update({_id: req.params.id}, params, function(err, data){
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
		Coupon.findOne({_id: req.params.id}, function(err, discount){
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
		Coupon.remove({_id: req.params.id}, function(err){
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
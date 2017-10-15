var DiscountsService = require('../services/discounts');

module.exports = {
	
	add: function(req, res, next) {
		var params = req.body;
		DiscountsService.add({ customer: params.customerId, coupon: params.coupon }, function(err, result) {
			if(err) {
				if(err instanceof Error) return next(err);
				return res.json({ success: false, error: err });
			}
			res.json({ success: true });
		});
	},

	get: function(req, res, next){
		DiscountsService.get({ customer: req.body.customerId, expired: false }, function(err, array){
			if(err) {
				if(err instanceof Error) return next(err);
				return res.json({ success: false, error: err });
			}
			res.json({ success: true, result: array });
		});
	}

};
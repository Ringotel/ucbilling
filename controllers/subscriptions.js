var SubscriptionsService = require('../services/subscriptions');
var debug = require('debug')('billing');

module.exports = {
	get: get,
	create: create,
	update: update,
	renew: renew,
	changePlan: changePlan,
	getSubscriptionAmount: getSubscriptionAmount
};

function create(req, res, next){
	var params = req.body;
	SubscriptionsService.create(params, function (err, result){
		if(err) return next(new Error(err));
		res.json({ success: true, result: result });
	});
}

function update(req, res, next) {
	var params = req.body;
	SubscriptionsService.updateSubscription(params, function(err, result) {
		if(err) return next(new Error(err));
		res.json({
			success: true,
			result: result
		});
	});
}

function renew(req, res, next){
	var params = req.body;
	SubscriptionsService.renewSubscription(params, function (err, result){
		if(err) return next(new Error(err));
		res.json({
			success: true,
			result: result
		});
	});
}

function changePlan(req, res, next){
	var params = req.body;

	SubscriptionsService.changePlan(params, function (err, result){
		if(err) return next(new Error(err));
		res.json({ success: true, result: result });
	});
}



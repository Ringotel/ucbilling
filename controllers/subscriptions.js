var SubscriptionsService = require('../services/subscriptions');
var debug = require('debug')('billing');
var config = require('../env/index');
var Analytics = require('analytics-node');
var analytics = new Analytics(config.segmentKey);

module.exports = {
	get: get,
	getAll: getAll,
	getAmount: getAmount,
	create: create,
	update: update,
	renew: renew,
	changePlan: changePlan
};

function get(req, res, next){
	var params = req.body;
	debug('subscription controller get: ', params);
	SubscriptionsService.get({ customer: params.customerId, branch: params.branchId }, function (err, result){
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
}

function getAll(req, res, next){
	var params = req.body;
	var customerId = params.partnerId || params.customerId;
	
	SubscriptionsService.getAll({ customer: customerId, $or: [{ state: { $ne: 'canceled' } }, { status: { $ne: 'canceled' } }]  }, function (err, result){
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
}

function getAmount() {
	var params = req.body;
	debug('getAmount controller get: ', params);
	SubscriptionsService.getAmount({ customer: params.customerId, branch: params.branchId }, function (err, result){
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
}

function create(req, res, next){
	var params = req.body;
	SubscriptionsService.create(params, function (err, result){
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });

		analytics.track({
		  userId: params.customerId.toString(),
		  event: 'Subscription Created',
		  properties: {
		  	planId: params.subscription.planId,
		  	amount: result.amount
		  }
		});
	});
}

function update(req, res, next) {
	var params = req.body;
	SubscriptionsService.update(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.status(err.status || err.statusCode || 400).json({ success: false, error: err });
		}
		res.json({
			success: true,
			result: result
		});
	});
}

function renew(req, res, next){
	var params = req.body;
	SubscriptionsService.renew(params, function (err, result){
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({
			success: true,
			result: result
		});

	});
}

function changePlan(req, res, next){
	var params = req.body;

	SubscriptionsService.changePlan(params, function (err, result){
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
}



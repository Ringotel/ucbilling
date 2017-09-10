var SubscriptionsService = require('../services/subscriptions');
var debug = require('debug')('billing');

module.exports = {
	get: get,
	getAll: getAll,
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
	SubscriptionsService.getAll({ customer: params.customerId, state: { $ne: 'canceled' } }, function (err, result){
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
	});
}

function update(req, res, next) {
	var params = req.body;
	SubscriptionsService.update(params, function(err, result) {
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



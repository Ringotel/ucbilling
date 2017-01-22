var SubscriptionsService = require('../services/subscriptions');
var debug = require('debug')('billing');

module.exports = {
	canCreateTrialSub: canCreateTrialSub,
	create: create,
	update: update,
	renew: renew,
	changePlan: changePlan,
	getSubscriptionAmount: getSubscriptionAmount
};

function canCreateTrialSub(req, res, next){
	SubscriptionsService.canCreateTrialSub(req.decoded, function(err, result){
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

function create(req, res, next){
	var params = req.body;
	params.customer = req.decoded;
	SubscriptionsService.createSubscription(params, function (err, result){
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

function update(req, res, next) {
	var params = req.body;
	SubscriptionsService.updateSubscription(params, function(err, result) {
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

function renew(req, res, next){
	var params = req.body;
	SubscriptionsService.renewSubscription(params, function (err, result){
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

function changePlan(req, res, next){
	var params = req.body;
	SubscriptionsService.changePlan(params, function (err, result){
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

function getSubscriptionAmount(req, res, next){

	var params = req.body;

	debug('getAmount params: ', params);

	SubscriptionsService.getAmount(params, function (err, amount){
		debug('getAmount result: ', err, amount);
		if(err){
			return res.json({
				success: false,
				message: err
			});
		} else {
			res.json({
				result: amount
			});
		}
	});
}



var utils = require('../lib/utils');
var moment = require('moment');
var Plans = require('./plans');
var Addons = require('./addons');
var Subscription = require('../models/subscriptions');
var debug = require('debug')('billing');
var async = require('async');

function extendAddOns(params, cb){

	var addOnsArray = [];

	if(params.addOns.length){

		Addons.getAll(function (err, result){
			if(err){
				cb(err);
				return;
			} else {

				result.forEach(function (item){
					params.addOns.forEach(function (addOn){
						if(item.id === addOn.id){
							addOnsArray.push(utils.deepExtend(item, addOn));
						}
					});
				});

				cb(null, addOnsArray);
			}
		});
	} else {
		cb(null, addOnsArray);
	}
}

function countSubscriptionAmount(addOnsArray, subscriptionPrice, cb){

	var amount = 0;

	if(addOnsArray.length){
		async.each(addOnsArray, function (addOn, cb){
			amount += parseFloat(addOn.price)*addOn.quantity;
		}, function (err){
			if(err){
				cb(err);
			} else {
				amount += parseFloat(subscriptionPrice);
				cb(null, amount);
			}
		});
	} else {
		amount += parseFloat(subscriptionPrice);
		cb(amount);
	}

}

module.exports = {

	getAll: function(params, cb){
		Subscriptions.find(params, function (err, subs){
			if(err){
				cb(err);
			} else {
				cb(null, subs);
			}
		});
	},

	get: function(params, cb){
		Subscriptions.findOne(params, function (err, sub){
			if(err) {
				cb(err);
			} else {
				cb(null, sub);
			}
		});
	},
	
	add: function(params, cb){
		Plans.get({id: params.planId}, function (err, plan){
			if(err){
				cb(err);
			} else {

				extendAddOns(params, function (err, addOnsArray){

					if(err){
						cb(err);
						return;
					}

					countSubscriptionAmount(addOnsArray, subParams.price, function (err, amount){

						if(err){
							cb(err);
							return;
						}

						var subParams = utils.extend({}, plan);
						var nextBillingDate = moment().add(subParams.billingFrequency, subParams.frequencyUnit);

						subParams.customerId = params.customerId;

						subParams.branch = {
							sid: params.server,
							oid: params.branchId
						};

						subParams.amount += amount;

						subParams.addOns = subParams.addOns.concat(addOnsArray);

						if(subParams.trialPeriod)
							subParams.trialExpires = moment().add(plan.trialDuration, plan.trialDurationUnit).unix();

						subParams.nextBillingDate = nextBillingDate.unix();

						subParams.billingCyrcles = nextBillingDate.diff(moment(), 'days');

						subParams.nextBillingAmount = subAmount / subParams.billingCyrcles;

						debug('subscription save: ', subParams);
						var newSub = new Subscription(subParams);
						newSub.save(function (err, sub){
							if(err){
								cb(err);
							} else {
								cb(null, sub);
							}
						});

					});
				});
			}
		});
	},

	update: function(query, params, cb){
		debug('update subscription: %s', params);
		res.json({success: true});
		Subscription.findOne(query, function (err, sub){
			if(err) {
				cb(err);
			} else {
				async.watefall([

					function (cb){
						if(sub.planId !== params.planId){
							Plans.get({id: params.planId}, function (err, plan){
								if(err){
									cb(err);
								} else {
									cb(null, plan);
								}
							});
						} else {
							cb(null);
						}
					},
					function (plan, cb){
						var subParams = {};

						extendAddOns(params, function (err, addOnsArray){

							if(err){
								cb(err);
								return;
							}

							countSubscriptionAmount(addOnsArray, sub.price, function (err, amount){

								if(err){
									cb(err);
									return;
								}

								if(plan){
									utils.deepExtend(sub, plan);
									sub.addOns = addOnsArray.concat(plan.addOns);
									var nextBillingDate = moment().add(subParams.billingFrequency, subParams.frequencyUnit);
									subParams.nextBillingDate = nextBillingDate.unix();
									subParams.billingCyrcles = nextBillingDate.diff(moment(), 'days');
									subParams.nextBillingAmount = subAmount / subParams.billingCyrcles;
								}

								if(sub.amount !== amount)
									sub.amount = amount;

								debug('subscription save: ', subParams);
								sub.save(function (err, newSub){
									if(err){
										cb(err);
									} else {
										cb(null, newSub);
									}
								});

							});
						});
					}
					], function (err, newSub){
						if(err){
							cb(err);
						} else {
							cb(null, newSub);
						}
					}
				);
			}
		});
	},

	updateState: function(query, params, cb){
		debug('update state: ', params);
		Subscription.findOne(query, function (err, sub){
			if(err){
				cb(err);
			} else {
				debug('update subscription status: ', sub);
				// var statusStr = params.enabled ? 'active' : 'paused';
				// if(sub.status === 'paused' && statusStr === 'active'){ // count differernce between last state change and current state change to add it to the nextBillingDate
				// 	var diff = Date.now() - sub.updatedAt;
				// 	debug('difference: %s', diff);
				// 	sub.nextBillingDate += diff;
				// }
				sub.state = params.state;
				sub.save(function (err){
					if(err){
						cb(err);
					} else {
						debug('subscription status updated: %s', result);
						res.json({
							success: true
						});
					}
				});
			}
		});
	},

	cancel: function(query, cb){
		Subscription.update(query, {state: 'canceled'}, function (err){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true});
			}
		});
	}
};
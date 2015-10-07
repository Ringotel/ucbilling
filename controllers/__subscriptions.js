var utils = require('../lib/utils');
var bhelper = require('../lib/bhelper');
var moment = require('moment');
// var Big = require('big.js');
var Plans = require('./plans');
var Addons = require('./addons');
var Subscription = require('../models/subscriptions');
var debug = require('debug')('billing');
var async = require('async');

function extendAddOns(addOns, cb){

	var addOnsArray = [];

	if(addOns.length){

		Addons.getAll(function (err, result){
			if(err){
				cb(err);
				return;
			} else {

				result.forEach(function (item){
					addOns.forEach(function (addOn){
						if(item.name === addOn.name){
							addOnsArray.push(utils.deepExtend(item, addOn));
						}
					});
				});

				if(cb) cb(null, addOnsArray);
			}
		});
	} else {
		if(cb) cb(null, addOnsArray);
	}
}

// function countSubscriptionAmount(addOnsArray, subscriptionPrice, callback){

// 	var amount = 0;

// 	if(addOnsArray.length){
// 		async.each(addOnsArray, function (addOn, cb){
// 			amount += parseFloat(addOn.price)*addOn.quantity;
// 			cb();
// 		}, function (err){
// 			if(err){
// 				callback(err);
// 			} else {
// 				amount += parseFloat(subscriptionPrice);
// 				callback(null, amount);
// 			}
// 		});
// 	} else {
// 		amount += parseFloat(subscriptionPrice);
// 		callback(null, amount);
// 	}

// }

var methods = {
	/**
	 * Check if a particular subscription belongs to the user.
	 * @param  {Object}   params [description]
	 * @param  {Function} cb     [description]
	 * @return {Object}         if valid returns subscription, if else returns error 
	 */
	isValid: function(params, cb){
		debug('isValid params: ', params);
		Subscription.findOne(params, function (err, result){
			if(err){
				cb(err);
			} else if(result) {
				cb(null);
			} else {
				cb('Not Found');
			}
		});
	},

	getAll: function(params, cb){
		Subscription.find(params, '-_id -_v', function (err, subs){
			if(err){
				cb(err);
			} else {
				cb(null, subs);
			}
		});
	},

	get: function(params, cb){
		Subscription.findOne(params, function (err, sub){
			if(err) {
				cb(err);
			} else {
				cb(null, sub);
			}
		});
	},
	
	add: function(params, callback){
		
		var subParams, nextBillingDate, newSub;
		debug('add subscription params: ', params);
		async.waterfall([

			function (cb){
				Plans.get({name: params.planId}, function (err, plan){
					if(err) return cb(err);
					
					subParams = utils.deepExtend({}, plan);

					cb();
				});
			},
			function (cb){
				extendAddOns(params.addOns, function (err, addOnsArray){
					if(err) return cb(err);
					cb(null, addOnsArray);
				});
			},
			// function (addOnsArray, cb){
			// 	countSubscriptionAmount(addOnsArray, subParams.price, function (err, amount){
			// 		if(err) return cb(err);
			// 		cb(null, addOnsArray, amount);
			// 	});
			// },
			// function (addOnsArray, amount, cb){
			function (addOnsArray, cb){

				nextBillingDate = moment().add(subParams.billingFrequency, subParams.frequencyUnit);

				subParams.customerId = params.customerId;
				subParams.planId = params.planId;
				if(params.quantity) subParams.quantity = params.quantity;
				// subParams.quantity = bhelper.getPoolSize(params.result.extensions);
				subParams.addOns = subParams.addOns.concat(addOnsArray);
				// subParams.amount = amount.toString();

				if(subParams.trialPeriod)
					subParams.trialExpires = moment().add(subParams.trialDuration, subParams.trialDurationUnit).valueOf();

				subParams.nextBillingDate = nextBillingDate.valueOf();
				subParams.billingCyrcles = nextBillingDate.diff(moment(), 'days');
				// subParams.nextBillingAmount = Big(amount).div(subParams.billingCyrcles).toString();

				delete subParams._id;
				delete subParams._v;
				delete subParams.updatedAt;
				delete subParams.createdAt;

				newSub = new Subscription(subParams);
				newSub.save(function (err, sub){
					if(err){
						cb(err);
					} else {
						cb(null, sub);
					}
				});

			}

		], function (err, sub){
			if(err) return callback(sub);
			callback(null, sub);
		});
	},

	// update: function(query, params, callback){
	update: function(sub, params, callback){
		debug('update subscription: ', sub, params);
		// Subscription.findOne(query, function (err, sub){
		// 	if(err) {
		// 		callback(err);
		// 	} else {
			if(params.planId && (sub.planId !== params.planId)){
				// if(params.planId === 'Trial'){ //TODO - set reliable plan identifier
					return callback('ChangePlanError');
				// }
			}
			var newPlan = null;
				async.waterfall([

					// function (cb){
					// 	Plans.get({name: params.planId}, function (err, plan){
					// 		if(err){
					// 			cb(err);
					// 		} else {
					// 			newPlan = plan;
					// 			cb();
					// 		}
					// 	});
					// },
					function (cb){
						extendAddOns(params.addOns, function (err, addOnsArray){
							if(err) return cb(err);
							cb(null, addOnsArray);
						});
					},
					// function (addOnsArray, cb){
					// 	countSubscriptionAmount(addOnsArray, sub.price, function (err, newAmount){
					// 		if(err) return cb(err);
					// 		cb(null, addOnsArray, newAmount);
					// 	});
					// },
					// function (addOnsArray, newAmount, cb){
					function (addOnsArray, cb){

						// if(newPlan !== null){
						// 	utils.deepExtend(sub, newPlan);
						// 	sub.addOns = addOnsArray.concat(newPlan.addOns);
						// 	var nextBillingDate = moment().add(sub.billingFrequency, sub.frequencyUnit);
						// 	sub.nextBillingDate = nextBillingDate.unix();
						// 	sub.billingCyrcles = nextBillingDate.diff(moment(), 'days');
						// 	sub.nextBillingAmount = newAmount / sub.billingCyrcles;
						// }

						sub.addOns = addOnsArray;
						// sub.quantity = bhelper.getPoolSize(params.result.extensions);
						// sub.nextBillingAmount = Big(newAmount).div(sub.billingCyrcles).toString();

						// if(sub.amount !== newAmount)
						// 	sub.amount = newAmount.toString();

						sub.save(function (err, newSub){
							if(err){
								cb(err);
							} else {
								cb(null, newSub);
							}
						});
					}], function (err, newSub){
						if(err){
							callback(err);
						} else {
							callback(null, newSub);
						}
					}
				);
		// 	}
		// });
	},

	updateState: function(query, params, cb){
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
				sub.update({state: params.state}, function (err){
					if(err){
						cb(err);
					} else {
						cb();
					}
				});
			}
		});
	},

	cancel: function(query, cb){
		Subscription.update(query, {state: 'canceled', updatedAt: Date.now()}, function (err){
			if(err){
				cb(err);
			} else {
				cb();
			}
		});
	},

	getAmount: function(params, callback){

		var sub,
			amount,
			subAmount = 0;

		async.waterfall([

			function (cb){
				Plans.get({name: params.planId}, cb);
			},
			function (plan, cb){
				params.price = plan.price;
				extendAddOns(params.addOns, cb);
			},
			function (addOnsArray, cb){
				params.addOns = addOnsArray;
				cb();
			},
			function (cb){
				sub = new Subscription(params);
				amount = sub.countAmount();
				cb(null, amount);
			}],
			function (err, amount){
				if(err){
					callback(err);
					return;
				}
				callback(null, amount);
			}
		);
	}
};

module.exports = methods;
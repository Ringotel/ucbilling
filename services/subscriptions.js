var Subscription = require('../models/subscriptions');
var Plans = require('../controllers/plans');
var Addons = require('../controllers/addons');
var CustomersService = require('./customers');
var BranchesService = require('./branches');
var async = require('async');
var utils = require('../lib/utils');
var bhelper = require('../lib/bhelper');
var moment = require('moment');
var debug = require('debug')('billing');

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

function createSubscriptionObj(params, callback){
	var subParams, nextBillingDate, newSub;
	debug('add subscription params: ', params);
	async.waterfall([

		function (cb){
			Plans.get({_id: params.planId}, function (err, plan){
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
		if(err) return callback(err);
		callback(null, sub);
	});
}

var methods = {

	createSubscription: function(params, callback){

		// var params = req.body;

		async.waterfall([
			//add parameters to branch options object
			//from plan customData parameter
			function (cb){
				Plans.get({ _id: params._subscription.planId }, function (err, plan){
					if(err) {
						return cb(err);
					}
					params.result.maxlines = plan.customData.maxlines;
					cb(null, plan);
				});
			},
			function (plan, cb){
				CustomersService.isEnoughCredits(params.customerId, plan.price, function (err, isEnough){
					if(err) {
						return cb(err);
					}
					if(!isEnough) {
						return cb('NOT_ENOUGH_CREDITS');
					} else {
						cb();
					}
				});
			},
			function (cb){
				BranchesService.isPrefixValid(params.result.prefix, function (err, result){
					if(err) return cb(err);
					if(!result) return cb('INVALID_PREFIX');
					cb();
				});
			},
			function (cb){
				BranchesService.createBranch({customerId: params.customerId, sid: params.sid, params: params.result}, function (err, branch){
					if(err) {
						return cb(err);
					}
					cb(null, branch);
				});
			},
			function (branch, cb){
				var newSub = {
					customerId: params.customerId,
					planId: params._subscription.planId,
					quantity: params._subscription.quantity,
					// quantity: bhelper.getPoolSize(params.result.extensions),
					addOns: params._subscription.addOns
				};

				createSubscriptionObj(newSub, function (err, sub){
					if(err){
						cb(err); //TODO - handle the error. Possible solution - remove branch created in previous step
					} else {

						branch._subscription = sub._id;
						branch.save(function (err, newBranch){
							if(err) return cb(err); //TODO - handle the error. Possible solution - remove branch created in previous step
							cb(null, newBranch.oid);
						});

					}
				});
			}], function (err, branchId){
				if(err){
					callback(err);
				} else {
					callback(null, branchId);
				}
			}
		);
	},

	changePlan: function(params, callback){

		async.waterfall([
			function (cb){
				Plans.get({ _id: params.planId }, function (err, plan){
					if(err) {
						return cb(err);
					}
					cb(null, plan);
				});
			},
			function (plan, cb){
				CustomersService.isEnoughCredits(params.customerId, plan.price, function (err, isEnough){
					if(err) {
						return cb(err);
					}
					if(!isEnough) {
						return cb('NOT_ENOUGH_CREDITS');
					} else {
						cb(null, plan);
					}
				});
			},
			function (plan, cb){
				BranchesService.getBranch({customerId: params.customerId, oid: params.oid}, function (err, branch){
					if(err) return cb(err);
					var requestParams = {
						oid: params.oid,
						maxlines: plan.customData.maxlines,
						enabled: true
					};
					BranchesService.updateBranch({ sid: branch.sid, params: requestParams }, function (err){
						if(err) {
							cb(err);
						} else {
							cb(null, branch);
						}
					});
				});
			},
			function (branch, cb){
				var sub = branch._subscription;
				var newSubParams = {
					customerId: params.customerId,
					planId: params.planId,
					quantity: 1,
					addOns: sub.addOns
				};
				createSubscriptionObj(newSubParams, function (err, newSub){
					if(err) {
						return cb(err);
					}
					branch._subscription = newSub._id;
					branch.save(function (err){
						if(err) {
							return cb(err);
						}
						methods.cancel({_id: sub._id}, function (err){
							if(err) return cb(err);
							debug('canceled');
							cb();
						});
					});
				});
			}
		], function (err){
			if(err) {
				return callback(err);
			}
			callback();
		});
	},

	renewSubscription: function(params, callback){

		async.waterfall([
			function (cb){
				BranchesService.getBranch({ customerId: params.customerId, oid: params.oid }, function (err, branch){
					if(err) return cb(err);
					cb(null, branch);
				});
			},
			function (branch, cb){
				CustomersService.isEnoughCredits(params.customerId, branch._subscription.amount, function (err, isEnough){
					if(err) {
						cb(err);
					}
					if(!isEnough) {
						cb('NOT_ENOUGH_CREDITS');
					} else {
						cb(null, branch);
					}
				});
			},
			function (branch, cb){
				var diff = moment(branch._subscription.nextBillingDate).diff(branch._subscription.createdAt, 'days');
				if(diff > 10) return cb('ERROR_OCCURRED');
				cb();
			},
			function (branch, cb){
				var sub = branch._subscription;
				if(sub.state !== 'expired' && sub.state !== 'canceled') {
					
					var nextBillingDate = moment(sub.nextBillingDate);
					var newNextBillingDate = moment(sub.nextBillingDate).add(sub.billingFrequency, sub.frequencyUnit);

					sub.billingCyrcles += newNextBillingDate.diff(nextBillingDate, 'days');
					sub.nextBillingDate = newNextBillingDate.valueOf();
					// sub.nextBillingAmount = (sub.amount / sub.billingCyrcles).toString(); // set the next billing amount for the new circle
					
					debug('renewSubscription subscription: %o', sub);

					sub.save(function (err){
						if(err) {
							return cb(err);
						}
						cb();
					});
				} else {
					methods.setBranchState({
						customerId: branch.customerId,
						method: 'setBranchState',
						result: {
							oid: branch.oid,
							enabled: true
						}
					}, function (err){
						if(err) {
							return cb(err);
						}
						var subParams = {
							customerId: sub.customerId,
							planId: sub.planId,
							quantity: sub.quantity,
							addOns: sub.addOns
						};
						createSubscriptionObj(subParams, function (err, newSub){
							if(err) {
								return cb(err);
							}
							branch._subscription = newSub._id;
							branch.save(function (err){
								if(err) {
									return cb(err);
								}
								
								methods.cancel({_id: sub._id}, function (err){
									if(err) {
										return cb(err);
									}
									cb();
								});
							});
						});
					});
				}
			}
		], function (err){
			//TODO - log the result
			if(err) {
				return callback(err);
			}
			callback(null, 'OK');
		});
	},

	update: function(sub, params, callback){

		if(params.planId && (sub.planId !== params.planId)){
				return callback('ChangePlanError');
		}

		var newPlan = null;
		async.waterfall([
			function (cb){
				extendAddOns(params.addOns, function (err, addOnsArray){
					if(err) return cb(err);
					cb(null, addOnsArray);
				});
			},
			function (addOnsArray, cb){
				sub.addOns = addOnsArray;
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
	},

	cancel: function(query, cb){
		Subscription.update(query, {state: 'canceled', updatedAt: Date.now()}, function (err){
			if(err) return cb(err);
			cb();
		});
	},

	getAmount: function(params, callback){

		var sub,
			amount,
			subAmount = 0;

		async.waterfall([

			function (cb){
				Plans.get({_id: params.planId}, cb);
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
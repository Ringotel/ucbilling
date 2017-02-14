var Subscription = require('../models/subscriptions');
var Plans = require('../services/plans');
var Addons = require('../services/addons');
var CustomersService = require('./customers');
var BranchesService = require('./branches');
var async = require('async');
var utils = require('../lib/utils');
var bhelper = require('../lib/bhelper');
var moment = require('moment');
var debug = require('debug')('billing');
var Big = require('big.js');

function extendAddOns(addOns, cb){

	var addOnsKeys = Object.keys(addOns);
	if(addOnsKeys.length){
		Addons.getAll(function (err, result){
			if(err){
				cb(err);
				return;
			} else {
				addOnsKeys.forEach(function(key){
					if(result[key]) {
						addOns[key] = utils.deepExtend(result[key], addOns[key]);
					}
				});

				if(cb) cb(null, addOns);
			}
		});
	} else {
		if(cb) cb(null, addOnsKeys);
	}
}

function createSubscriptionObj(params, plan, cb){
	var subParams = utils.deepExtend({}, plan);

	subParams.customerId = params.customerId;
	subParams.description = params.description;
	subParams.planId = params.planId;

	if(params.quantity) subParams.quantity = params.quantity;
	subParams.addOns = params.addOns;

	if(plan.trialPeriod) {
		subParams.trialExpires = moment().add(plan.trialDuration, plan.trialDurationUnit).valueOf();
	} else {
		subParams.lastBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit).valueOf();
		subParams.billingCyrcles = moment(subParams.lastBillingDate).diff(moment(), 'days') + 1;

	}
	
	subParams.nextBillingDate = moment().add(1, 'day').valueOf();

	delete subParams._id;
	delete subParams.__v;
	delete subParams.updatedAt;
	delete subParams.createdAt;


	cb(null, subParams);
}

function setMinQuantity(planId, quantity){
	var minQuantity = 4,
		isSetMin = (planId === 'trial' || planId === 'free' || quantity < minQuantity);

	return isSetMin ? minQuantity : null;
	
}

var methods = {

	getSubscriptions: function(params, callback) {
		Subscription
		.find(params)
		.populate('_branch')
		.lean()
		.exec(function (err, subs){

			if(err) return callback(err);

			async.each(subs, function (sub, cb){
				methods.getBranchSettings({oid: sub._branch.oid, sid: sub._branch.sid}, function (err, result){
					if(err) return cb();
					sub._branch = utils.extend(sub._branch, result);
					cb();
				});
			}, function (err){
				if(err) return callback(err);
				debug('getSubscriptions: ', subs);
				callback(null, subs);
			});

		});
	},

	createSubscription: function(params, callback){

		var newSub = {}, planParams = {}, addOnsObj = {}, newSubParams = {}, customer;

		debug('createSubscription params: ', params);

		async.waterfall([
			function(cb){
				CustomersService.get(params.customerId, function(err, result){
					if(err) return cb(err);
					customer = result;
					cb();
				});
			},
			function(cb){
				if(params._subscription.planId === 'trial') {
					methods.canCreateTrialSub(customer, function(err, result){
						if(err) return cb(err);
						debug('createSubscription canCreateTrialSub: ', result);
						if(!result) return cb('Forbidden');
						cb();
					});
				} else {
					cb();
				}
					
			},
			function (cb){
				BranchesService.isPrefixValid(params.result.prefix, function (err, result){
					if(err) return cb(err);
					if(!result) return cb('INVALID_PREFIX');
					cb();
				});
			},
			function (cb){
				BranchesService.isNameValid(params.result.name, function (err, result){
					if(err) return cb(err);
					if(!result) return cb('INVALID_NAME');
					cb();
				});
			},
			function (cb){
				Plans.getOne({ planId: params._subscription.planId }, '-_state -_id -__v -createdAt -updatedAt', function (err, plan){
					if(err) return cb(err);
					planParams = plan;
					cb();
				});
			},
			function (cb){
				extendAddOns(params._subscription.addOns, function (err, addOns){
					if(err) return cb(err);
					addOnsObj = addOns;
					cb();
				});
			},
			function (cb){
				newSubParams = {
					customerId: params.customerId,
					description: params._subscription.description,
					planId: params._subscription.planId,
					quantity: setMinQuantity(params._subscription.planId, params._subscription.quantity) || params._subscription.quantity,
					addOns: addOnsObj
				};

				createSubscriptionObj(newSubParams, planParams, function (err, subParams){
					if(err){
						cb(err); //TODO - handle the error. Possible solution - remove branch created in previous step
					} else {
						newSub = new Subscription(subParams);
						newSub.validate(function(err) {
							debug('newSub validate err: ', err);
						});
						debug('subParams: %o', subParams, newSub);
						cb(null, newSub.countAmount());
					}
				});
			},
			function (amount, cb){
				debug("createSubscription, is enough money: ", customer, amount);
				// is enough money on customer's balance
				if(parseFloat(customer.balance) >= parseFloat(amount)) {
					cb();
				} else {
					cb('NOT_ENOUGH_CREDITS');
				}
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
				debug('createSubscription newSub: ', newSub);

				newSub._branch = branch._id;
				newSub.save(function (err, result){
					if(err) return cb(err);
					debug('New saved subscription: %o', result);

					branch._subscription = result._id;
					branch.save(function (err, newBranch){
						if(err) return cb(err); //TODO - handle the error. Possible solution - remove branch created in previous step
						cb(null, newBranch.oid);
					});
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

	changePlan: function(params, callback) {

		var newSub = {}, branch = {}, addOnsObj = {}, planParams = {}, planChanged = false;

		async.waterfall([
			function(cb) {
				BranchesService.getBranch({ customerId: params.customerId, oid: params.oid }, function (err, result){
					if(err) return cb(err);
					branch = result;
					cb(null, branch);
				});
			},
			function(branch, cb) {
				if(branch._subscription.planId !== 'trial' && branch._subscription.planId !== 'free' && (params._subscription.planId === 'trial' || params._subscription.planId === 'free'))
					return cb('ERROR_OCCURRED');
				
				Plans.getOne({ planId: params._subscription.planId }, '-_id -_state -__v', function (err, plan){
					if(err) return cb(err);
					planParams = plan;
					cb();
				});

			},
			function(cb) {
				extendAddOns(params._subscription.addOns, function (err, addOns){
					if(err) return cb(err);
					addOnsObj = addOns;
					cb();
				});
			},
			function(cb) {

				var newSubParams = {
					customerId: params.customerId,
					description: params._subscription.description,
					planId: params._subscription.planId,
					quantity: setMinQuantity(params._subscription.planId, params._subscription.quantity) || params._subscription.quantity,
					addOns: addOnsObj
				};

				createSubscriptionObj(newSubParams, planParams, function(err, result) {

					newSub = new Subscription(result);
					newSub.amount = newSub.countAmount();
					newSub.nextBillingAmount = newSub.countNextBillingAmount(newSub.amount);
					// newSub._branch = branch._id;

					debug('changePlan params: ', params);
					debug('changePlan planParams: ', planParams);

					cb(null, newSub.nextBillingAmount);
				});

			},
			function(amount, cb) {
				CustomersService.isEnoughCredits(params.customerId, amount, function (err, isEnough){
					if(err) {
						cb(err);
					}
					if(!isEnough) {
						cb('NOT_ENOUGH_CREDITS');
					} else {
						cb();
					}
				});
			},
			function(cb) {
				debug('changePlan newSub: ', newSub);
				newSub.validate(function(err) {
					debug('changePlan validateSync err: ', err);
				});
				newSub.save(function (err, result){
					debug('changePlan save error: ', err);
					if(err) return cb(err);

					branch._subscription = result._id;
					branch.save(function (err){
						if(err) {
							return cb(err);
						}
						methods.cancel({_id: params._subscription._id}, function (err){
							if(err) return cb(err);
							debug('canceled');
							cb(null, branch);
						});
					});
				});
			},
			function(branch, cb) {
				var requestParams = {
					oid: params.oid,
					name: params.result.name,
					extensions: params.result.extensions,
					lang: params.result.lang,
					maxusers: newSub.quantity,
					maxlines: params.result.maxlines,
					storelimit: params.result.storelimit,
					config: planParams.customData.config
				};
				
				if(params.result.adminpass) {
					requestParams.adminname = params.result.adminname;
					requestParams.adminpass = params.result.adminpass;
				}

				debug('changePlan updateBranch requestParams: ', requestParams);

				BranchesService.updateBranch({ sid: branch.sid, params: requestParams }, function (err){
					if(err) {
						cb(err);
					} else {
						cb(null, branch);
					}
				});
			}
		], function (err, branch){
			if(err) return callback(err);
			callback(null, branch);
		});

	},

	updateSubscription: function(params, callback) {
		var newSub = {}, branch = {}, addOnsObj = {};
		
		async.waterfall([
			function(cb) {
				BranchesService.getBranch({ customerId: params.customerId, oid: params.oid }, function (err, result){
					if(err) return cb(err);
					branch = result;
					cb();
				});
			},
			function(cb) {
				if(branch._subscription.planId !== params._subscription.planId)
					return cb('ERROR_OCCURRED');
				
				cb();
			},
			function(cb) {
				extendAddOns(params._subscription.addOns, function (err, addOns){
					if(err) return cb(err);
					addOnsObj = addOns;
					cb();
				});
			},
			function(cb) {
				newSub = branch._subscription;
				newSub.quantity = setMinQuantity(params._subscription.planId, params._subscription.quantity) || params._subscription.quantity;
				newSub.addOns = addOnsObj;
				newSub.amount = newSub.countAmount();
				newSub.nextBillingAmount = newSub.countNextBillingAmount(newSub.amount);
				
				debug('updateSubscription: ', params, newSub);
				cb(null, newSub.nextBillingAmount);
			},
			function(amount, cb) {
				CustomersService.isEnoughCredits(params.customerId, amount, function (err, isEnough){
					if(err) {
						cb(err);
					}
					if(!isEnough) {
						cb('NOT_ENOUGH_CREDITS');
					} else {
						cb();
					}
				});
			},
			function(cb) {
				newSub.save(function (err, result){
					if(err) return cb(err);
					cb();
						
				});
			},
			function(cb) {
				var requestParams = {
					oid: params.oid,
					name: params.result.name,
					extensions: params.result.extensions,
					lang: params.result.lang,
					maxusers: newSub.quantity,
					maxlines: params.result.maxlines,
					storelimit: params.result.storelimit
				};
				
				if(params.result.adminpass) {
					requestParams.adminname = params.result.adminname;
					requestParams.adminpass = params.result.adminpass;
				}

				BranchesService.updateBranch({ sid: branch.sid, params: requestParams }, function (err){
					if(err) {
						cb(err);
					} else {
						cb(null, branch);
					}
				});
			}
		], function (err, branch){
			if(err) return callback(err);
			callback(null, branch);
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
				var requestParams = {
					customerId: params.customerId,
					method: 'setBranchState',
					state: 'active',
					result: {
						oid: params.oid,
						enabled: true
					}
				};

				BranchesService.setBranchState(requestParams, function (err, result){
					if(err) {
						return cb(err);
					}
					cb(null, branch);
				});
			},
			// function (branch, cb){
			// 	var diff = moment(branch._subscription.lastBillingDate).diff(branch._subscription.createdAt, 'days');
			// 	// Can't renew subscription if it's more than certain amount of time until it expires
			// 	if(diff > 10) return cb('ERROR_OCCURRED');
			// 	cb(null, branch);
			// },
			function (branch, cb){
				var sub = branch._subscription, lastBillingDate;

				if(sub.planId === 'trial' || sub.planId === 'free' || sub.state === 'canceled') {
					return cb('ERROR_OCCURRED');
				}

				if(sub.state === 'expired') {
					lastBillingDate = moment().add(sub.billingPeriod, sub.billingPeriodUnit);

				} else {
					lastBillingDate = moment(sub.lastBillingDate).add(sub.billingPeriod, sub.billingPeriodUnit);
					// sub.nextBillingAmount = Big(sub.amount).plus(leftAmount).div(sub.billingCyrcles).valueOf(); // set the next billing amount for the new cycle

				}

				sub.billingCyrcles = lastBillingDate.diff(moment(), 'days');
				sub.lastBillingDate = lastBillingDate.valueOf();
				sub.nextBillingAmount = Big(sub.amount).div((sub.billingCyrcles - sub.currentBillingCyrcle)).valueOf();
				
				debug('renewSubscription: %o', sub);

				sub.save(function (err){
					if(err) {
						return cb(err);
					}
					cb();
				});

			}
		], function (err){
			//TODO - log the result
			if(err) {
				return callback(err);
			}
			callback(null, 'OK');
		});
	},

	cancel: function(query, cb){
		Subscription.update(query, {state: 'canceled', updatedAt: Date.now()}, function (err){
			if(err) return cb(err);
			cb();
		});
	},

	canCreateSubscription: function(customer, cb){
		debug('canCreateSubscription customer: ', customer);
		Subscription.count({ customerId: customer._id, $or: [{ state: 'active' }, { state: 'expired' }] }, function(err, count){
			if(err) return cb(err);
			if(count > 0 && (customer.role !== 'admin' && customer.role !== 'reseller')) return cb('Forbidden');
			cb();
		});
	},

	canCreateTrialSub: function(customer, cb){
		Subscription.count({ customerId: customer._id, planId: 'trial' }, function(err, count){
			debug('canCreateTrialSub customer: ', count, customer);
			if(err) return cb(err);
			if(count > 0 && (customer.role !== 'admin' && customer.role !== 'reseller')) return cb(null, false);
			cb(null, true);
		});
	},

	getAmount: function(params, callback){

		var sub,
			amount,
			subAmount = 0;

		async.waterfall([

			function (cb){
				Plans.getOne({ planId: params.planId }, null, cb);
			},
			function (plan, cb){
				params.price = plan.price;
				extendAddOns(params.addOns, cb);
			},
			function (addOns, cb){
				params.addOns = addOns;
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
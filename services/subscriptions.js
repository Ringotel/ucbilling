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
var logger = require('../modules/logger').api;

function extendAddOns(addOns, cb){

	debug('extendAddOns addOns: ', addOns);
	var extAddons = [];

	if(addOns.length){
		Addons.getAll(function (err, result){

			debug('extendAddOns getAll: ', err, result);

			if(err) return cb(err);
			result.forEach(function(addon) {
				addOns.forEach(function(item){
					if(addon.name === item.name) {
						extAddons.push(utils.deepExtend(addon, item));
					}
				});
			});

			if(cb) cb(null, extAddons);
		});
	} else {
		if(cb) cb(null, addOns);
	}
}

function canChangePlan(currentSub, newPlan){
	return !(currentSub.planId !== 'trial' && currentSub.planId !== 'free' && (newPlan._id === 'trial' || newPlan._id === 'free'));
}

// function extendAddOns(addOns, cb){

// 	var addOnsKeys = Object.keys(addOns);
// 	if(addOnsKeys.length){
// 		Addons.getAll(function (err, result){
// 			if(err) return cb(err);
// 			addOnsKeys.forEach(function(key){
// 				if(result[key]) {
// 					addOns[key] = utils.deepExtend(result[key], addOns[key]);
// 				}
// 			});

// 			if(cb) cb(null, addOns);
// 		});
// 	} else {
// 		if(cb) cb(null, addOnsKeys);
// 	}
// }

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
		subParams.billingCycles = moment(subParams.lastBillingDate).diff(moment(), 'days');

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

	getSubscription: function(params, callback) {
		Subscription
		.findOne(params)
		.populate('_branch')
		.lean()
		.exec(function (err, sub){

			if(err) return callback(err);
			if(!sub) return callback({ name: 'ENOENT', message: 'subscription not found' });

			debug('getSubscription: ', sub);
			callback(null, sub);

		});
	},

	getSubscriptions: function(params, callback) {
		Subscription
		.find(params)
		.populate('_branch')
		.lean()
		.exec(function (err, subs){

			if(err) return callback(err);

			async.each(subs, function (sub, cb){
				methods.getBranchSettings({oid: sub._branch.oid, sid: sub._branch.sid}, function (err, result){
					if(err) return cb(err);
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

		var newSub = {}, planParams = {}, addOnsObj = {}, newSubParams = {}, newBranchParams = {}, customer = {};

		debug('createSubscription params: ', params);

		async.waterfall([
			function(cb){
				// if(params.customer) {
				// 	customer = params.customer;
				// 	cb();
				// } else {
					CustomersService.get({ _id: params.customerId }, function(err, result){
						debug('get customer: ', err, result);

						if(err) return cb(err);
						customer = result;
						cb();
					});
				// }
					
			},
			// function(cb){
			// 	if(params._subscription.planId === 'trial') {
			// 		methods.canCreateTrialSub(customer, function(err, result){
			// 			if(err) return cb(err);
			// 			debug('createSubscription canCreateTrialSub: ', result);
			// 			if(!result) return cb('Forbidden');
			// 			cb();
			// 		});
			// 	} else {
			// 		cb();
			// 	}
			// },
			function (cb){
				BranchesService.isNameAndPrefixValid(params.result.name, params.result.prefix, function (err, result){
					if(err) return cb(err);

					debug('isNameAndPrefixValid: ', result);

					if(!result) return cb({ name: 'EINVAL', message: 'invalid name or prefix' });
					cb();
				});
				// BranchesService.isPrefixValid(params.result.prefix, function (err, result){
				// 	if(err) return cb(err);

				// 	debug('isPrefixValid: ', result);

				// 	if(!result) return cb('INVALID_PREFIX');
				// 	cb();
				// });
			},
			// function (cb){
			// 	BranchesService.isNameValid(params.result.name, function (err, result){
			// 		if(err) return cb(err);

			// 		debug('isNameValid: ', result);					

			// 		if(!result) return cb('INVALID_NAME');
			// 		cb();
			// 	});
			// },
			function (cb){
				Plans.getOne({ planId: params._subscription.planId }, '-_state -_id -__v -createdAt -updatedAt', function (err, plan){
					if(err) return cb(err);

					debug('Plans.getOne: ', plan);

					planParams = plan;
					cb();
				});
			},
			function (cb){
				extendAddOns(params._subscription.addOns || [], function (err, addOns){
					if(err) return cb(err);

					debug('extendAddOns: ', addOns);

					addOnsObj = addOns;
					cb();
				});
			},
			function (cb){
				newSubParams = {
					customerId: params.customerId,
					description: params._subscription.description,
					planId: params._subscription.planId,
					quantity: planParams.customData.maxusers || params._subscription.quantity,
					// quantity: setMinQuantity(params._subscription.planId, params._subscription.quantity) || params._subscription.quantity,
					addOns: addOnsObj
				};

				debug('newSubParams: ', newSubParams);

				createSubscriptionObj(newSubParams, planParams, function (err, subParams){
					if(err){
						cb(err); //TODO - handle the error. Possible solution - remove branch created in previous step
					} else {
						newSub = new Subscription(subParams);
						newSub.validate(function(err) {
							debug('newSub validate err: %o', err.errors);
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
					cb({ name: 'ECANCELED', message: 'not enough credits' });
				}
			},
			function (amount, cb) {
				// Charge customer
				cb();
			},
			function (cb){
				newBranchParams = {
					customerId: params.customerId,
					sid: params.sid,
					params: params.result
				};

				newBranchParams.params.config = planParams.customData.config || [];

				BranchesService.createBranch(newBranchParams, function (err, branch){
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

	/**
	 * changePlan
	 * 
	 * @param  {customerId}
	 * @param  {branchId}
	 * @param  {planId}
	 */
	changePlan: function(params, callback) {

		var branch = {}, plan = {}, newSub = {}, oldSub = {}, addOnsObj = {};

		if(!params.branchId) return callback({ name: 'ERR_MISSING_ARGS', message: 'branchId is undefined' });

		logger.info('changePlan. Params: %j', params);

		async.waterfall([
			function(cb) {
				BranchesService.getBranch({ customerId: params.customerId, _id: params.branchId }, function (err, result){
					if(err) return cb(err);
					if(!result) return cb({ name: 'ENOENT', message: 'branch not found', branchId: branchId });

					branch = result;
					oldSub = branch._subscription;
					cb(null, branch);
				});
			},
			function(branch, cb) {
				Plans.getOne({ planId: params.planId }, '-_id -_state -__v', function (err, result){
					if(err) return cb(err);
					if(!result) return cb({ name: 'ENOENT', message: ('plan not found'), planId: params.planId });
					plan = result;
					cb(null, branch, plan);
				});
			},
			function(branch, plan, cb) {
				if(branch._subscription.numId > plan.numId) return cb({ name: 'ECANCELED', message: 'can\'t change plan', planId: plan._id });
				cb(null, branch, plan);
			},
			function(branch, plan, cb) {
				extendAddOns(plan.addOns || [], function (err, addOns){
					if(err) return cb(err);
					addOnsObj = utils.deepExtend(branch._subscription.addOns, addOns);
					cb(null, branch, plan, addOnsObj);
				});
			},
			function(branch, plan, addOns, cb) {

				var newSubParams = {
					customerId: params.customerId,
					planId: params.planId,
					quantity: plan.customData.maxusers || branch._subscription.quantity,
					// quantity: setMinQuantity(params.planId, branch._subscription.quantity) || branch._subscription.quantity,
					addOns: addOns
				};

				logger.info('changePlan.createSubscriptionObj. newSubParams: %j', newSubParams);

				createSubscriptionObj(newSubParams, plan, function(err, result) {

					newSub = new Subscription(result);
					newSub._branch = branch._id;
					newSub.amount = newSub.countAmount();
					newSub.nextBillingAmount = newSub.countNextBillingAmount(newSub.amount);

					debug('changePlan params: ', params);
					debug('changePlan planParams: ', plan);

					// cb(null, newSub.nextBillingAmount);
					cb(null, newSub);
				});

			},
			function(newSub, cb) {
				CustomersService.isEnoughCredits(params.customerId, newSub.amount, function (err, isEnough){
					if(err) return cb(err);
					if(!isEnough) return cb({ name: 'ECANCELED', message: 'not enough credits' });
					cb(null);
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
						if(err) return cb(err);
						methods.cancel({_id: oldSub._id}, function (err){
							if(err) return cb(err);
							debug('newSub '+ result._id +' canceled');
							cb();
						});
					});
				});
			},
			function(cb) {
				var storageperuser = plan.customData.storageperuser;
				var storelimit = plan.customData.storelimit ? plan.customData.storelimit : (storageperuser * newSub.quantity);
				var maxlines = plan.customData.maxlines || (newSub.quantity * plan.customData.linesperuser);
				var requestParams = {
					oid: branch.oid,
					maxusers: newSub.quantity,
					maxlines: maxlines,
					storageperuser: storageperuser,
					storelimit: storelimit,
					config: plan.customData.config
				};

				logger.info('changePlan.updateBranch %s. requestParams: %j', branch.oid, requestParams);

				BranchesService.updateBranch({ sid: branch.sid, params: requestParams }, function (err){
					if(err) return cb(err);
					cb();
				});
			}
		], function (err){
			if(err) {
				logger.info('changePlan. branchId: %s. Error: %j', params.branchId, err);
				return callback(err);
			}
			logger.info('changePlan. branchId: %s. Success: %j', params.branchId, params);
			callback(null, newSub);
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
				extendAddOns(params._subscription.addOns || [], function (err, addOns){
					if(err) return cb(err);
					addOnsObj = addOns;
					cb();
				});
			},
			function(cb) {
				newSub = branch._subscription;
				newSub.quantity = params._subscription.quantity;
				// newSub.quantity = setMinQuantity(params._subscription.planId, params._subscription.quantity) || params._subscription.quantity;
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
						cb({ name: 'ECANCELED', message: 'not enough credits' });
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

				//***********
				//	Add/Change branch parameters here
				//**********

				var requestParams = {
					oid: params.oid,
					name: params.result.name,
					extensions: params.result.extensions,
					lang: params.result.lang,
					maxusers: newSub.quantity,
					maxlines: params.result.maxlines,
					storelimit: params.result.storelimit,
					timezone: params.result.timezone
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
					if(!branch) return cb({ name: 'ENOENT', message: 'branch not found', branchId: branchId });
					cb(null, branch);
				});
			},
			function (branch, cb){
				CustomersService.isEnoughCredits(params.customerId, branch._subscription.amount, function (err, isEnough){
					if(err) {
						cb(err);
					}
					if(!isEnough) {
						cb({ name: 'ECANCELED', message: 'not enough credits' });
					} else {
						cb(null, branch);
					}
				});
			},
			function (branch, cb){
				var requestParams = {
					method: 'setBranchState',
					state: 'active',
					enabled: true
				};

				BranchesService.setBranchState({ customerId: params.customerId, _id: branch._id }, requestParams, function (err, result){
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
					return cb({ name: 'ECANCELED', message: 'can\'t renew subscription' });
				}

				if(sub.state === 'expired') {
					lastBillingDate = moment().add(sub.billingPeriod, sub.billingPeriodUnit);
					sub.billingCycles += lastBillingDate.diff(moment(), 'days');
					sub.nextBillingDate = moment().add(1, 'd').valueOf();
					sub.prevBillingDate = Date.now();

				} else {
					lastBillingDate = moment(sub.lastBillingDate).add(sub.billingPeriod, sub.billingPeriodUnit);
					sub.billingCycles += lastBillingDate.diff(sub.lastBillingDate, 'days');
					// sub.nextBillingAmount = Big(sub.amount).plus(leftAmount).div(sub.billingCycles).valueOf(); // set the next billing amount for the new cycle

				}

				
				sub.lastBillingDate = lastBillingDate.valueOf();
				sub.chargeTries = 0;

				// sub.billingCycles = lastBillingDate.diff(moment(), 'days');
				// sub.nextBillingAmount = Big(sub.amount).div((sub.billingCycles - sub.currentBillingCycle)).valueOf();
				
				debug('renewSubscription result: %o', sub);

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
	}

	// getAmount: function(params, callback){

	// 	var sub,
	// 		amount,
	// 		subAmount = 0;

	// 	async.waterfall([

	// 		function (cb){
	// 			Plans.getOne({ planId: params.planId }, null, cb);
	// 		},
	// 		function (plan, cb){
	// 			params.price = plan.price;
	// 			extendAddOns(params.addOns || [], cb);
	// 		},
	// 		function (addOns, cb){
	// 			params.addOns = addOns;
	// 			cb();
	// 		},
	// 		function (cb){
	// 			sub = new Subscription(params);
	// 			amount = sub.countAmount();
	// 			cb(null, amount);
	// 		}],
	// 		function (err, amount){
	// 			if(err){
	// 				callback(err);
	// 				return;
	// 			}
	// 			callback(null, amount);
	// 		}
	// 	);
	// }

};

module.exports = methods;
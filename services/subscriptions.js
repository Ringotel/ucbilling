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

				// result.forEach(function (item){
				// 	addOns.forEach(function (addOn){
				// 		if(item.name === addOn.name){
				// 			addOnsArray.push(utils.deepExtend(item, addOn));
				// 		}
				// 	});
				// });

				// if(cb) cb(null, addOnsArray);
				if(cb) cb(null, addOns);
			}
		});
	} else {
		if(cb) cb(null, addOnsKeys);
	}
}

function createSubscriptionObj(params, callback){
	var planParams, subParams, lastBillingDate, newSub;
	debug('add subscription params: ', params);
	async.waterfall([

		function (cb){
			Plans.get({ planId: params.planId}, function (err, plan){
				if(err) return cb(err);
				
				planParams = plan;
				subParams = utils.deepExtend({}, planParams);

				cb();
			});
		},
		function (cb){
			extendAddOns(params.addOns, function (err, addOns){
				if(err) return cb(err);
				cb(null, addOns);
			});
		},
		function (addOns, cb){

			subParams.customerId = params.customerId;
			// subParams.planId = params.planId;
			if(params.quantity) subParams.quantity = params.quantity;
			// if(params.trialPeriod) subParams.trialPeriod = params.trialPeriod;
			subParams.addOns = addOns;

			// lastBillingDate = moment().add(subParams.billingPeriod, subParams.billingPeriodUnit).add(1, 'd');
			lastBillingDate = moment().add(subParams.billingPeriod, subParams.billingPeriodUnit);

			subParams.billingCyrcles = (lastBillingDate.diff(moment(), 'days')) + 1; // add one cyrcle

			if(subParams.trialPeriod) {
				subParams.billingCyrcles = 0;
				subParams.trialExpires = moment().add(subParams.trialDuration, subParams.trialDurationUnit).valueOf();
				subParams.lastBillingDate = lastBillingDate.add(subParams.trialDuration, subParams.trialDurationUnit).valueOf();
			} else {
				subParams.billingCyrcles = (lastBillingDate.diff(moment(), 'days')) + 1; // add one cyrcle
				subParams.lastBillingDate = lastBillingDate.valueOf();
			}
			
			subParams.nextBillingDate = moment().add(1, 'day').valueOf();
			// subParams.nextBillingAmount = Big(amount).div(subParams.billingCyrcles).toString();

			delete subParams._id;
			delete subParams._v;
			delete subParams.updatedAt;
			delete subParams.createdAt;

			cb(null, subParams);

			// newSub = new Subscription(subParams);
			// newSub.save(function (err, sub){
			// 	if(err){
			// 		cb(err);
			// 	} else {
			// 		cb(null, sub);
			// 	}
			// });

		}

	], function (err, subParams){
		if(err) return callback(err);
		callback(null, subParams, planParams);
	});
}

var methods = {

	createSubscription: function(params, callback){

		var newSub = null, newSubParams, subAmount, customer;

		async.waterfall([
			function(cb){
				CustomersService.get(params.customerId, function(err, result){
					if(err) return cb(err);
					customer = result;
					cb();
				});
			},
			function(cb){
				methods.canCreateSubscription(customer, function(err){
					if(err) return cb(err);
					cb();
				});
			},
			function (cb){
				newSubParams = {
					customerId: params.customerId,
					planId: params._subscription.planId,
					quantity: (params._subscription.planId === 'trial' || params._subscription.planId === 'free' || params._subscription.quantity < 4) ? 4 : params._subscription.quantity,
					addOns: params._subscription.addOns
				};

				createSubscriptionObj(newSubParams, function (err, subParams){
					if(err){
						cb(err); //TODO - handle the error. Possible solution - remove branch created in previous step
					} else {
						debug('subParams: %o', subParams);
						newSub = new Subscription(subParams);
						cb(null, newSub);
					}
				});
			},
			//add parameters to branch options object
			//from plan customData parameter
			function (newsub, cb){
				Plans.get({ planId: params._subscription.planId }, function (err, plan){
					if(err) {
						return cb(err);
					}
					
					params.result.config = plan.customData.config;
					params.result.maxusers = (plan.planId === 'trial' || plan.planId === 'free' || params._subscription.quantity < 4) ? 4 : params._subscription.quantity;
					subAmount = newsub.countAmount();
					cb(null, plan, subAmount);
				});
			},
			function (plan, amount, cb){
				CustomersService.isEnoughCredits(customer, amount, function (err, isEnough){
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
				BranchesService.isNameValid(params.result.name, function (err, result){
					if(err) return cb(err);
					if(!result) return cb('INVALID_NAME');
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
				newSub.save(function (err, newsub){
					if(err) return cb(err);
					debug('newSub: %o', newsub);

					branch._subscription = newsub._id;
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

	updateSubscription: function(params, callback) {
		var newSub, planParams, planChanged = false;
		async.waterfall([
			function(cb) {
				BranchesService.getBranch({ customerId: params.customerId, oid: params.oid }, function (err, branch){
					if(err) return cb(err);
					cb(null, branch);
				});
			},
			function(branch, cb) {
				if(branch._subscription.planId !== params._subscription.planId) {
					if(branch._subscription.planId !== 'trial' && branch._subscription.planId !== 'free' && (params._subscription.planId === 'trial' || params._subscription.planId === 'free'))
						return cb('ERROR_OCCURRED');

					createSubscriptionObj(params._subscription, function(err, result, plan) {

						planParams = plan;
						// leave the lastBillingDate unchanged, we're not renewing subscription
						result.lastBillingDate = params._subscription.lastBillingDate;
						newSub = new Subscription(result);
						newSub.amount = newSub.countAmount();
						newSub.nextBillingAmount = newSub.countNextBillingAmount(newSub.amount);

						planChanged = true;

						debug('updateSubscription: ', newSub, planParams);
						cb(null, branch, newSub.nextBillingAmount);
					});
				} else {
					newSub = branch._subscription;
					// if(branch._subscription.quantity !== params._subscription.quantity) {
						newSub.quantity = (params._subscription.planId === 'trial' || params._subscription.planId === 'free' || params._subscription.quantity < 4) ? 4 : params._subscription.quantity;
						newSub.addOns = params._subscription.addOns;
						newSub.amount = newSub.countAmount();
						newSub.nextBillingAmount = newSub.countNextBillingAmount(newSub.amount);
						// newSub.amount = parseFloat(newSub.price)*newSub.quantity;
						// if(newSub.amount > 0)
						// 	newSub.nextBillingAmount = Big(newSub.amount).div(newSub.billingCyrcles).toFixed(4).toString();
						// else
						// 	newSub.nextBillingAmount = 0;
					// }
					debug('updateSubscription: ', params, newSub, planParams);
					cb(null, branch, newSub.nextBillingAmount);
				}
			},
			function(branch, amount, cb) {
				CustomersService.isEnoughCredits(params.customerId, amount, function (err, isEnough){
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
			function(branch, cb) {
				newSub.save(function (err, result){
					if(err) return cb(err);

					if(planChanged) {
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
					} else {
						cb(null, branch);
					}
						
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
					storelimit: params.result.storelimit
				};
				if(planChanged && planParams) {
					requestParams.config = planParams.customData.config;
					// requestParams.storelimit = params.result.storelimit;
				}
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
		], function (err){
			if(err) return callback(err);
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
			// function (branch, cb){
			// 	var diff = moment(branch._subscription.lastBillingDate).diff(branch._subscription.createdAt, 'days');
			// 	// Can't renew subscription if it's more than certain amount of time until it expires
			// 	if(diff > 10) return cb('ERROR_OCCURRED');
			// 	cb(null, branch);
			// },
			function (branch, cb){
				var sub = branch._subscription;
				if(sub.planId === 'trial' || sub.planId === 'free') {
					return cb('ERROR_OCCURRED');
				}
				if(sub.state !== 'expired' && sub.state !== 'canceled') {
					
					var lastBillingDate = moment(sub.lastBillingDate);
					var leftAmount = (sub.billingCyrcles - sub.currentBillingCyrcle) * sub.nextBillingAmount + parseFloat(sub.amount);
					var newLastBillingDate = moment(sub.lastBillingDate).add(sub.billingPeriod, sub.billingPeriodUnit);

					sub.billingCyrcles += newLastBillingDate.diff(lastBillingDate, 'days');
					sub.lastBillingDate = newLastBillingDate.valueOf();
					sub.nextBillingAmount = (leftAmount / sub.billingCyrcles).toString(); // set the next billing amount for the new circle
					
					debug('renewSubscription: %o', sub);

					sub.save(function (err){
						if(err) {
							return cb(err);
						}
						cb();
					});
				} else {
					BranchesService.setBranchState({
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
						var newSubParams = {
							customerId: sub.customerId,
							planId: sub.planId,
							trialPeriod: false,
							quantity: sub.quantity,
							addOns: sub.addOns
						};
						createSubscriptionObj(newSubParams, function (err, subParams){
							if(err) {
								return cb(err);
							}

							new Subscription(subParams).save(function (err, newSub){
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
				extendAddOns(params.addOns, function (err, addOns){
					if(err) return cb(err);
					cb(null, addOns);
				});
			},
			function (addOns, cb){
				sub.addOns = addOns;
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

	canCreateSubscription: function(customer, cb){
		debug('canCreateSubscription customer: ', customer);
		Subscription.count({ customerId: customer._id, $or: [{ state: 'active' }, { state: 'expired' }] }, function(err, count){
			if(err) return cb(err);
			debug('canCreateSubscription count: ', count, (count > 0 && (customer.role !== 'admin' || customer.role !== 'reseller')), customer);
			if(count > 0 && (customer.role !== 'admin' && customer.role !== 'reseller')) return cb('Forbidden');
			cb();
		});
	},

	getAmount: function(params, callback){

		var sub,
			amount,
			subAmount = 0;

		async.waterfall([

			function (cb){
				Plans.get({ planId: params.planId }, cb);
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
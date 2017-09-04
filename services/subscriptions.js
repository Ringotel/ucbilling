var Subscriptions = require('../models/subscriptions');
var PlansService = require('./plans');
var AddonsService = require('./addons');
var CustomersService = require('./customers');
var BranchesService = require('./branches');
var CheckoutService = require('./checkout');
var async = require('async');
var utils = require('../lib/utils');
var bhelper = require('../lib/bhelper');
var moment = require('moment');
var debug = require('debug')('billing');
var Big = require('big.js');
var logger = require('../modules/logger').api;

function extendAddOns(addOns, callback){

	debug('extendAddOns addOns: ', addOns);
	var extAddons = [];

	if(addOns && addOns.length){
		AddonsService.get()
		.then(function(result) {

			debug('extendAddOns addOns: ', result);

			result.forEach(function(addon) {
				addOns.forEach(function(item){
					if(addon.name === item.name) {
						extAddons.push(utils.deepExtend(addon, item));
					}
				});
			});

			callback(null, extAddons);
		})
		.catch(function(err) {
			callback(err);
		});
	} else {
		callback(null, []);
	}
}

function get(params, callback) {
	Subscriptions
	.findOne(params)
	.populate('branch')
	.lean()
	.exec()
	.then((sub) => {

		if(!sub) return callback({ name: 'ENOENT', message: 'subscription not found' });

		debug('getSubscription: ', sub);
		callback(null, sub);

	})
	.catch(err => callback(err));
}

function getAll(params, callback) {
	Subscriptions
	.find(params)
	.populate('branch')
	.lean()
	.exec()
	.then(subs => callback(null, subs))
	.catch(err => callback(err));

	// async.each(subs, function (sub, cb){
	// 	getBranchSettings({oid: sub.branch.oid, sid: sub.branch.sid}, function (err, result){
	// 		if(err) return cb(err);
	// 		sub.branch = utils.extend(sub.branch, result);
	// 		cb();
	// 	});
	// }, function (err){
	// 	if(err) return callback(err);
	// 	debug('getSubscriptions: ', subs);
	// 	callback(null, subs);
	// });
}

function payInvoice(invoice) {

	var totalAmount = Big(0),
		totalProrated = Big(0),
		creditUsed = Big(0),
		balance = Big(0),
		customer = invoice.customer;
	
	async.waterfall([
		function(cb) {
			// get customer object
			if(typeof customer === 'function') {
				cb(null, customer)
			} else {
				CustomersService.get({ _id: customer })
				.then(result => {
					customer = result;
					cb();
				})
				.catch(err => cb(err));
			}

		}, function(customer, cb) {
			// count payment amount
			balance = Big(customer.balance);

			invoice.items.forEach(item => {
				totalAmount.plus(item.amount);
				totalProrated.plus(item.proratedAmount || 0);
			});

			totalAmount = totalAmount.minus(totalProrated);

			if(balance.gte(totalAmount)) {
				totalAmount = Big(0);
				creditUsed = totalAmount;
			} else {
				totalAmount = totalAmount.minus(balance);
				creditUsed = balance;
			}

		}, function(cb) {
			// charge customer
			serviceParams = customer.billingDetails.filter((item) => { return (item.default && item.method === 'card') })[0];
			CheckoutService.stripe({
				amount: totalAmount.valueOf(),
				creditUsed: creditUsed.valueOf(),
				currency: invoice.currency,
				serviceParams: serviceParams
			})
			.then(transaction => cb(null, transaction))
			.catch(err => cb(err));

		}, function(transaction, cb) {
			// save invoice
			invoice.set({
				chargeId: transaction.chargeId,
				paymentSource: transaction.source,
				creditUsed: creditUsed.valueOf(),
				status: 'paid'
			});

			cb(null, invoice);

		}, function(invoice, cb) {
			// update customer
			customer.balance = Big(customer.balance).minus(invoice.creditUsed).valueOf();
			customer.save()
			.then(() => cb(invoice))
			.catch(err => cb(err));

		}

	], function(err, result) {
		new Promise((resolve, reject) => {
			if(err) return reject(err);
			resolve(result);
		});
	});
}

function create(params, callback) {
	var newSub = {}, plan = {}, addOns = {}, customer = {};

	debug('createSubscription params: ', params);

	async.waterfall([
		function(cb){
			// get customer
			CustomersService.get({ _id: params.customerId }, function(err, result){
				if(err) return cb(err);
				customer = result;
				cb();
			});			
		},
		function (cb){
			// check if branch prefix and branch name are available and a valid string
			BranchesService.isNameAndPrefixValid(params.branch.name, params.branch.prefix, function (err, result){
				if(err) return cb(err);
				if(!result) return cb({ name: 'EINVAL', message: 'invalid name or prefix' });
				cb();
			});
		},
		function (cb){
			// get plan
			PlansService.getOne({ planId: params.subscription.planId, _state: '1' }, '-_state -_id -__v -createdAt -updatedAt', function (err, result){
				if(err) return cb(err);
				plan = result;
				cb();
			});
		},
		function (cb){
			// extend addOns
			extendAddOns(params.subscription.addOns, function (err, result){
				if(err) return cb(err);
				addOns = result;
				cb();
			});
		},
		function (cb){
			// create new subscription
			let newSubParams = {
				customer: params.customerId,
				description: params.subscription.description,
				planId: params.subscription.planId,
				quantity: plan.customData.maxusers || params.subscription.quantity,
				plan: plan,
				addOns: addOns,
				prevBillingDate: Date.now()
			};

			if(plan.trial) {
				let trialExpires = moment().add(plan.trialDuration, plan.trialDurationUnit).valueOf();
				let nextBillingDate = moment(trialExpires).add(plan.billingPeriod, plan.billingPeriodUnit);
				newSubParams.trialExpires = trialExpires;
			} else {
				let nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit);	
			}

			newSubParams.nextBillingDate = nextBillingDate.valueOf();

			debug('newSubParams: ', newSubParams);

			newSub = new Subscriptions(newSubParams);
			newSub.validate(function(err) { debug('newSub validate err: %o', err.errors); });
			debug('newSub: %o', newSubParams, newSub);
			cb(null, newSub.countAmount());
		},
		function (cb){
			// generate invoice
			let invoice = new Invoices({
				customer: customer,
				subscription: sub._id,
				currency: sub.currency,
				items: [{
					currency: sub.currency,
					description: sub.description,
					amount: newSub.amount
				}]
			});

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay invoice
			payInvoice(invoice)
			.then(resultInvoice => {
				logger.info('payInvoice success: %j', JSON.stringify(result));
				resultInvoice.save();
				cb();
			})
			.catch(err => {
				logger.error('payInvoice error: %j invoice: %j', JSON.stringify(err), JSON.stringify(invoice));
				cb(err);
			});
		},
		function (cb){
			// create new branch
			let branchParams = {
				customerId: params.customerId,
				sid: params.sid,
				params: params.branch
			};
			branchParams.params.config = plan.customData.config || [];
			BranchesService.createBranch(branchParams, function (err, branch){
				if(err) return cb(err);
				cb(null, branch);
			});
		},
		function (branch, cb){
			// save new subscription
			debug('createSubscription branch created: ', branch);

			newSub.branch = branch._id;
			newSub.save()
			.then(result => cb(result))
			.catch(err => {
				// clean
				BranchesService.deleteBranch(branch);
				cb(err)
			});

		}], function (err, subscription){
			if(err) return callback(err);
			debug('New subscription created: %o', result);
			callback(null, subscription);
		}
	);
}

function changePlan(params, callback) {

	var sub = {}, newSub = {}, plan = {}, customer = {}, addOns = {};

	if(!params.subId || !params.planId) return callback({ name: 'ERR_MISSING_ARGS', message: 'subId or planId is undefined' });

	debug('changePlan params: %j', params);

	async.waterfall([
		function(cb){
			// get customer
			CustomersService.get({ _id: params.customerId }, function(err, result){
				if(err) return cb(err);
				customer = result;
				cb();
			});			
		},
		function(cb) {
			// get subscription
			Subscriptions.findOne({ customerId: params.customerId, _id: params.subId })
			.populate('branch')
			.then(function (result){
				if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', subId: subId });
				sub = result;
				cb();
			})
			.catch(err => cb(err));
		},
		function(cb) {
			// get plan
			PlansService.getOne({ planId: params.planId, _state: '1' }, '-_state -_id -__v -createdAt -updatedAt', function (err, result){
				if(err) return cb(err);
				if(!result) return cb({ name: 'ENOENT', message: ('plan not found'), planId: params.planId });
				plan = result;
				cb();
			});
		},
		function(cb) {
			// cancel on plan downgrade
			let numId = sub.numId !== undefined ? sub.numId : sub.plan.numId;
			if(numId > plan.numId) return cb({ name: 'ECANCELED', message: 'can\'t change plan', planId: plan._id });
			cb();
		},
		function(cb) {
			// update subscription
			sub.description = 'Subscription for '+plan.name+' plan'; // TODO: generate description
			sub.planId = plan.planId;
			sub.plan = plan;

			debug('changePlan newSub: %j', sub);

			cb(null, sub.countAmount());
		},
		function (amount, cb){
			// calculate proration and generate invoice
			let cycleDays = moment(sub.nextBillingDate).diff(moment(sub.prevBillingDate), 'days');
			let proratedDays = moment(sub.nextBillingDate).diff(moment(), 'days');
			let proratedAmount = Big(0);
			let subAmount = Big(sub.amount).times(proratedDays.div(cycleDays));
			let chargeAmount = Big(amount).times(proratedDays.div(cycleDays));

			if(chargeAmount.gte(subAmount)) {
				chargeAmount = chargeAmount.minus(subAmount);
			} else {
				proratedAmount = subAmount.minus(chargeAmount);
			}

			// if new plan with different billing period
			if(sub.plan.trialPeriod || sub.billingPeriod !== plan.billingPeriod || sub.billingPeriodUnit !== plan.billingPeriodUnit) {
				sub.nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit).valueOf();
				sub.prevBillingDate = Date.now();
			}

			let invoice = new Invoices({
				customer: customer,
				subscription: sub._id,
				currency: sub.currency,
				items: [{
					description: sub.description,
					amount: chargeAmount.valueOf(),
					proratedAmount: proratedAmount.valueOf()
				}]
			});

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay invoice
			payInvoice(invoice)
			.then(resultInvoice => {
				logger.info('payInvoice success: %j', JSON.stringify(result));
				resultInvoice.save();
				cb();
			})
			.catch(err => {
				logger.error('payInvoice error: %j invoice: %j', JSON.stringify(err), JSON.stringify(invoice));
				cb(err);
			});
		},
		function(cb) {
			// save new subscription
			sub.save()
			.then((result) => cb(null, result))
			.catch(err => cb(err));
		},
		function(cb) {
			// update branch params
			var storageperuser = plan.customData.storageperuser;
			var storelimit = plan.customData.storelimit ? plan.customData.storelimit : (storageperuser * newSub.quantity);
			var maxlines = plan.customData.maxlines || (newSub.quantity * plan.customData.linesperuser);
			var requestParams = {
				sid: sub.branch.sid,
				data: {
					method: 'updateBranch',
					params: {
						maxusers: newSub.quantity,
						maxlines: maxlines,
						storelimit: storelimit,
						config: plan.customData.config	
					}
				}
			};

			debug('changePlan updateBranch: %o', requestParams);
			ctiRequest(requestParams, function (err){
				if(err) return cb(err);
				cb();
			});
		}
	], function (err){
		if(err) {
			debug('changePlan error: %j', err);
			return callback(err);
		}
		debug('changePlan success: %j', newSub);
		callback(null, newSub);
	});

}

function renew(params, callback){
	debug('renewSubscription params: ', params);

	if(!params.subId) return callback({ name: 'ERR_MISSING_ARGS', message: 'subId is undefined' });

	var customer = {}, sub = {};

	async.waterfall([
		function(cb){
			// get customer
			CustomersService.get({ _id: params.customerId }, function(err, result){
				if(err) return cb(err);
				if(!result) return cb({ name: 'ENOENT', message: 'customer not found', customer: params.customerId });
				customer = result;
				cb();
			});			
		},
		function (cb){
			// get subscription
			Subscriptions.findOne({ customerId: params.customerId, _id: params.subId })
			.then(function (result){
				if(!result) return cb({ name: 'ENOENT', message: 'sub not found', subId: params.subId });
				sub = result;
				cb(null, sub);
			})
			.catch(err => cb(err));
		},
		function (cb){
			// generate invoice
			let invoice = new Invoices({
				customer: customer,
				subscription: sub._id,
				currency: sub.currency,
				items: [{
					currency: sub.currency,
					description: sub.description,
					amount: sub.amount
				}]
			});

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay invoice
			payInvoice(invoice)
			.then(resultInvoice => {
				logger.info('payInvoice success: %j', JSON.stringify(result));
				resultInvoice.save();
				cb();
			})
			.catch(err => {
				logger.error('payInvoice error: %j invoice: %j', JSON.stringify(err), JSON.stringify(invoice));
				cb(err);
			});
		},
		function (cb){
			// update and save subscription object

			if(sub.planId === 'trial' || sub.planId === 'free' || sub.state === 'canceled') {
				return cb({ name: 'ECANCELED', message: 'can\'t renew subscription' });
			}

			sub.nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit).valueOf();
			sub.prevBillingDate = Date.now();
			sub.state = 'active';

			debug('renewSubscription sub: %o', sub);

			sub.save()
			.then((result) => cb(null, result))
			.catch(err => cb(err));

		}
	], function (err, result){
		//TODO - log the result
		if(err) return callback(err);
		callback(null, 'OK');
	});
}

module.exports = {
	get: get,
	getAll: getAll,
	create: create,
	renew: renew,
	changePlan: changePlan,

	updateSubscription: function(params, callback) {
		var newSub = {}, branch = {}, addOnsObj = {};
		
		async.waterfall([
			function(cb) {
				BranchesService.get({ customerId: params.customerId, oid: params.oid }, function (err, result){
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
	}

};
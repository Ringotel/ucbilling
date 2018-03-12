var Subscriptions = require('../models/subscriptions');
var Invoices = require('../models/invoices');
var PlansService = require('./plans');
var AddonsService = require('./addons');
var CustomersService = require('./customers');
var BranchesService = require('./branches');
var InvoicesService = require('./invoices');
var async = require('async');
var utils = require('../lib/utils');
var bhelper = require('../lib/bhelper');
var moment = require('moment');
var debug = require('debug')('billing');
var Big = require('big.js');
var logger = require('../modules/logger').api;

module.exports = {
	get: get,
	getAll: getAll,
	getAmount: getAmount,
	create: create,
	renew: renew,
	changePlan: changePlan,
	update: update,
	cancel: cancel
};

function extendAddOns(array = [], addOns = []) {

	debug('extendAddOns addOns: ', array, addOns);

	if(!addOns.length) return [];
	if(!array.length) return addOns;

	return addOns.map(function(addon) {
		let newItem = {};
		array.forEach(function(item){
			if(addon.name === item.name) {
				newItem = utils.deepExtend(newItem, addon);
				newItem.quantity = item.quantity;
			}
		});
		return newItem;
	});
}

function getAddonItem(addons, name) {
	if(!addons.length) return {};
	return addons.reduce((prev, next) => {
		if(next.name === name) prev = next;
		return prev;
	}, {});
}

function get(params, callback) {
	Subscriptions
	.findOne(params)
	.populate('branch')
	.select('-branch.adminname -branch.adminpass')
	.lean()
	.exec()
	.then((sub) => {

		if(!sub) return callback({ name: 'ENOENT', message: 'subscription not found' });

		debug('get sub: ', sub);

		// BranchesService.getBranchSettings({ oid: sub.branch.oid, sid: sub.branch.sid }, function(err, result) {
		// 	if(err) return callback(new Error(err));

		// 	sub.branch = utils.deepExtend(sub.branch, result);

		// 	delete sub.branch.adminname;
		// 	delete sub.branch.adminpass;

			debug('getSubscription: ', sub);

			callback(null, sub);
		// });

	})
	.catch(err => callback(new Error(err)));
}

function getAll(params, callback) {
	Subscriptions
	.find(params)
	.populate('branch')
	.select('-branch.adminname -branch.adminpass')
	.lean()
	.exec()
	.then(subs => callback(null, subs))
	.catch(err => callback(new Error(err)));

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

function getAmount(params, callback) {
	Subscriptions.findOne(params)
	.then(sub => {
		if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', params: params });
		return sub.countAmount();
	})
	.then(amount => callback(null, amount))
	.catch(err => callback(err))
}

function create(params, callback) {
	var newSub = {}, plan = {};

	debug('createSubscription params: ', params);

	if(!params || !params.subscription || !params.branch) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'parameters are undefined' });

	if(!params.branch.name || !params.branch.adminname || !params.branch.adminpass) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'parameters are undefined' });

	async.waterfall([
		// function(cb) {
		// 	CustomersService.exists(params.customerId, function(err, result) {
		// 		if(err) return cb(new Error(err));
		// 		if(!result) return cb({ name: 'ENOENT', message: 'customer not found', customer: params.customerId });
		// 		cb();
		// 	});
		// },
		function (cb){
			// check if branch prefix and branch name are available and a valid string
			BranchesService.isNameAndPrefixValid(params.branch.name, params.branch.prefix, function (err, result){
				if(err) return cb(new Error(err));
				if(!result) return cb({ name: 'EINVAL', message: 'invalid name or prefix' });
				cb();
			});
		},
		function (cb){
			// get plan
			PlansService.getOne({ planId: params.subscription.planId, _state: '1' }, '-_state -_id -__v -createdAt -updatedAt', function (err, result){
				if(err) return cb(new Error(err));
				if(!result) return cb({ name: 'EINVAL', message: 'plan not found' });
				plan = result;

				debug('createSubscription plan: %o', plan);
				
				cb();
			});
		},
		function (cb){
			// create new subscription
			let newSubParams = {
				customer: params.customerId,
				description: params.subscription.description,
				planId: params.subscription.planId,
				quantity: plan.attributes.maxusers || params.subscription.quantity,
				plan: plan,
				addOns: extendAddOns(params.subscription.addOns, plan.addOns),
				prevBillingDate: Date.now()
			};
			let nextBillingDate = null;

			if(plan.trialPeriod) {
				nextBillingDate = moment().add(plan.trialDuration, plan.trialDurationUnit);
				newSubParams.trialExpires = moment().add(plan.trialDuration, plan.trialDurationUnit).valueOf();
			} else {
				nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit);	
			}

			newSubParams.nextBillingDate = nextBillingDate.valueOf();

			newSub = new Subscriptions(newSubParams);
			newSub.validate(function(err) { debug('newSub validate err: %o', err); });
			
			debug('createSubscription subscription: %o', newSub);
			
			newSub.countAmount()
			.then(amount => cb(null, amount))
			.catch(err => cb(err));

		},
		function (amount, cb){
			// generate invoice
			
			if(Big(amount).lte(0)) return cb(null, null); // do not create invoice

			let invoice = new Invoices({
				customer: params.customerId,
				subscription: newSub._id,
				currency: newSub.plan.currency,
				items: [{
					description: newSub.description,
					amount: amount
				}]
			});

			debug('createSubscription create invoice: %o', invoice);

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay and save an invoice
			
			if(!invoice) return cb();

			InvoicesService.pay(invoice)
			.then(result => cb())
			.catch(err => {
				logger.error('createSubscription payInvoice error: %j invoice: %j', err, invoice);
				cb(err);
			});
		},
		function (cb){
			// create new branch
			let planData = plan.attributes;
			let maxlines = planData.maxlines || (newSub.quantity * planData.linesperuser);
			let storelimit = planData.storelimit || (newSub.quantity * planData.storageperuser);
			let maxusers = planData.maxusers || newSub.quantity;

			let extraLines = getAddonItem(newSub.addOns, 'lines').quantity;
			let extraStorage = getAddonItem(newSub.addOns, 'storage').quantity;

			if(extraLines) maxlines += extraLines;
			if(extraStorage) storelimit += extraStorage;

			let branchParams = {
				name: params.branch.name,
				prefix: params.branch.prefix,
				extensions: params.branch.extensions || [{ firstnumber: 100, poolsize: 100 }],
				lang: params.branch.lang || 'en',
				maxusers: maxusers,
				maxlines: maxlines,
				admin: params.branch.admin,
				email: params.branch.email,
				storelimit: utils.convertBytes(storelimit, 'GB', 'Byte'),
				timezone: params.branch.timezone || 'Universal',
				config: planData.config || [],
				adminname: params.branch.adminname,
				adminpass: params.branch.adminpass
			}; 

			let requestParams = {
				customerId: params.customerId,
				sid: params.sid,
				branchParams: branchParams
			};

			debug('createSubscription create branch: %o', requestParams);

			BranchesService.create(requestParams, function (err, branch){
				if(err) return cb(err);
				cb(null, branch);
			});
		},
		function (branch, cb){
			// save new subscription
			debug('createSubscription branch created: ', branch);

			newSub.branch = branch._id.toString();
			newSub.save()
			.then(result => cb(null, result))
			.catch(err => {
				// clean
				BranchesService.deleteBranch(branch);
				cb(new Error(err))
			});

		}], function (err, subscription){
			if(err) return callback(err);
			debug('New subscription created: %o', subscription);
			callback(null, subscription);
		}
	);
}

function changePlan(params, callback) {

	var sub = {}, plan = {}, addOns = {}, prorationRatio = null, subAmount = null;

	if(!params.planId) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'subscription or planId is undefined' });

	debug('changePlan params: %j', params);

	async.waterfall([
		function(cb) {
			// get subscription
			Subscriptions.findOne({ customer: params.customerId, branch: params.branchId })
			.populate('branch')
			.then(result => {
				if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', params: params });
				sub = result;
				cb();
			})
			.catch(err => { 
				cb( new Error(err) );
			});
		},
		function(cb) {
			// get plan
			PlansService.getOne({ planId: params.planId, _state: '1' }, '-_state -_id -__v -createdAt -updatedAt', function (err, result){
				if(err) return cb(new Error(err));
				if(!result) return cb({ name: 'ENOENT', message: ('plan not found'), planId: params.planId });
				plan = result;
				cb();
			});
		},
		function(cb) {
			// cancel on plan downgrade
			let numId = sub.numId !== undefined ? sub.numId : sub.plan.numId;
			if(sub.plan.planId === plan.planId || plan.planId === 'trial' || plan.numId === 0) 
				return cb({ name: 'ECANCELED', message: 'can\'t change plan', planId: plan.planId });
			
			cb();
		},
		function(cb) {
			// update subscription
			
			prorationRatio = 1;
			subAmount = Big(sub.amount);

			// if new plan with different billing period
			if(sub.plan.trialPeriod || sub.plan.billingPeriod !== plan.billingPeriod || sub.plan.billingPeriodUnit !== plan.billingPeriodUnit) {
				sub.nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit).valueOf();
				sub.prevBillingDate = Date.now();
			} else {
				let cycleDays = moment(sub.nextBillingDate).diff(moment(sub.prevBillingDate), 'days');
				let proratedDays = moment(sub.nextBillingDate).diff(moment(), 'days');
				prorationRatio = Big(proratedDays).div(cycleDays);
				subAmount = subAmount.times(prorationRatio);
			}

			debug('changePlan update sub: ', prorationRatio, subAmount.valueOf());

			// change sub params
			// and count new subscription amount
			sub.state = sub.status = 'active';
			sub.plan = plan;
			sub.addOns = extendAddOns(sub.addOns, plan.addOns);
			sub.description = 'Subscription to "'+plan.name+'" plan'; // TODO: generate description

			debug('changePlan sub: %j', sub);
			
			sub.countAmount()
			.then(amount => cb(null, amount))
			.catch(err => cb(err));

		},
		function (amount, cb){
			// calculate proration and generate invoice
			
			let proratedAmount = Big(0);
			let chargeAmount = Big(amount).times(prorationRatio);

			if(chargeAmount.gte(subAmount)) {
				chargeAmount = chargeAmount.minus(subAmount);
			} else {
				proratedAmount = subAmount.minus(chargeAmount);
				chargeAmount = Big(0);
			}

			let invoice = new Invoices({
				customer: sub.customer,
				subscription: sub._id,
				currency: sub.plan.currency,
				items: [{
					description: sub.description,
					amount: chargeAmount.toFixed(2),
					proratedAmount: proratedAmount.toFixed(2)
				}]
			});

			debug('changePlan invoice generated: %o', amount, proratedAmount.valueOf(), chargeAmount.valueOf(), invoice);

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay invoice
			InvoicesService.pay(invoice)
			.then(resultInvoice => cb())
			.catch(err => {
				logger.error('payInvoice error: %j invoice: %j', err, invoice);
				cb(err);
			});
		},
		function(cb) {
			// save new subscription
			sub.save()
			.then((result) => {
				debug('changePlan sub saved: ', result);
				cb(null, result);
			})
			.catch(err => {
				debug('changePlan sub save error: ', err);
				cb(new Error(err));
			});
		},
		function(sub, cb) {
			// update branch params
			let planData = plan.attributes || plan.customData;
			let maxlines = planData.maxlines || (sub.quantity * planData.linesperuser);
			let storelimit = planData.storelimit || (sub.quantity * planData.storageperuser);
			let maxusers = planData.maxusers || sub.quantity;

			let extraLines = getAddonItem(sub.addOns, 'lines').quantity;
			let extraStorage = getAddonItem(sub.addOns, 'storage').quantity;

			if(extraLines) maxlines += extraLines;
			if(extraStorage) storelimit += extraStorage;

			let requestParams = {
				sid: sub.branch.sid,
				customerId: params.customerId,
				branchParams: {
					oid: sub.branch.oid,
					maxusers: maxusers,
					maxlines: maxlines,
					storelimit: utils.convertBytes(storelimit, 'GB', 'Byte'),
					config: planData.config	
				}
			};

			debug('changePlan updateBranch: %o', requestParams);
			BranchesService.update(requestParams, function (err, result){
				debug('changePlan update branch: %o', err, result);
				if(err) return cb(err);
				cb();
			});
		},
		function(cb) {
			if(sub.state !== 'active') {
				// enable branch if it is disabled
				BranchesService.setState({ branch: sub.branch, enabled: true }, function (err){
					// if(err) return cb();
					cb();
				});
			} else {
				cb();
			}
		}
	], function (err){
		if(err) {
			debug('changePlan error: %j', err);
			return callback(err);
		}
		debug('changePlan success: %j', sub);
		callback(null, sub);
	});

}

function update(params, callback) {
	debug('updateSubscription params: ', params);

	if((!params.addOns || !params.addOns.length) && !params.quantity) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'nothing to do' });

	var sub = {};
	var subAmount = null;
	var newSubAmount = null;

	async.waterfall([
		function (cb){
			// get subscription
			Subscriptions.findOne({ customer: params.customerId, branch: params.branchId })
			.populate('branch')
			.then(function (result){
				if(!result) return cb({ name: 'ENOENT', message: 'sub not found', params: params });
				if(result.plan.planId === 'trial' || result.plan.numId === 0) 
					return cb({ name: 'ECANCELED', message: 'Can\'t update subscription on trial plan.' });

				sub = result;
				subAmount = Big(sub.amount);
				cb();
			})
			.catch(err => cb(err));
		},
		function (cb){
			// extend params
			if(params.addOns && (Array.isArray(params.addOns))) {
				sub.addOns = sub.addOns.map(function(addon) {
					params.addOns.forEach(function(item){
						if(addon.name === item.name) {
							addon.quantity = item.quantity;
						}
					});
					return addon;
				});
			}

			if(params.quantity && !isNaN(params.quantity)) sub.quantity = params.quantity;

			sub.countAmount()
			.then(amount => cb(null, amount))
			.catch(err => cb(err));

		},
		function (newSubAmount, cb){
			// generate invoice
			let chargeAmount = Big(newSubAmount).minus(subAmount);

			debug('updateSubscription1: ', chargeAmount.valueOf());
			
			if(chargeAmount.lte(0)) return cb(null, null); // do nothing on downgrade

			let cycleDays = moment(sub.nextBillingDate).diff(moment(sub.prevBillingDate), 'days');
			let proratedDays = moment(sub.nextBillingDate).diff(moment(), 'days');
			
			chargeAmount = chargeAmount.times(Big(proratedDays).div(cycleDays));

			debug('updateSubscription2: ', chargeAmount.valueOf(), cycleDays, proratedDays);

			let invoice = new Invoices({
				customer: params.customerId,
				subscription: sub._id,
				currency: sub.plan.currency,
				items: [{
					description: "Subscription update",
					amount: chargeAmount.toFixed(2)
				}]
			});

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay invoice
			
			if(!invoice) return cb();

			InvoicesService.pay(invoice)
			.then(resultInvoice => cb())
			.catch(err => {
				logger.error('payInvoice error: %j invoice: %j', err, invoice);
				cb(err);
			});
		},
		function(cb) {
			// update branch
			// TODO - check if downgrade is allowed (get branch params)
			let planData = sub.plan.attributes || sub.plan.customData;
			let maxlines = sub.quantity * planData.linesperuser;
			let storelimit = sub.quantity * planData.storageperuser;
			let maxusers = sub.quantity;

			let extraLines = getAddonItem(sub.addOns, 'lines').quantity;
			let extraStorage = getAddonItem(sub.addOns, 'storage').quantity;

			if(extraLines) maxlines += extraLines;
			if(extraStorage) storelimit += extraStorage;

			let requestParams = {
				sid: sub.branch.sid,
				customerId: params.customerId,
				branchParams: {
					oid: sub.branch.oid,
					maxusers: maxusers,
					maxlines: maxlines,
					storelimit: utils.convertBytes(storelimit, 'GB', 'Byte')
				}
			};

			debug('updateBranch cti request: %o', requestParams);
			BranchesService.update(requestParams, function (err, result){
				debug('updateBranch cti request result: ', err, result);
				if(err) return cb(err);
				sub.branch = utils.deepExtend(sub.branch, result);
				cb();
			});
		},
		function (cb){
			// update and save subscription object
			debug('updateSubscription sub: %o', sub);

			sub.save()
			.then((result) => cb(null, result))
			.catch(err => cb(err));

		}
	], function (err, result){
		//TODO - log the result
		if(err) return callback(err);
		callback(null, result);
	});
}

function renew(params, callback){
	debug('renewSubscription params: ', params);

	var sub = {};

	async.waterfall([
		function(cb) {
			Subscriptions.findOne({ customer: params.customerId, branch: params.branchId })
			.then(function (result){
				if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', params: params });
				sub = result;
				cb();
			})
			.catch(err => cb(err));
		},
		function(cb) {
			InvoicesService.get({ subscription: sub._id, status: 'past_due' })
			.then(invoices => cb(null, invoices))
			.catch(cb);
		},
		function(invoices, cb) {
			debug('renewSubscription pas_due invoices: ', invoices);
			// pay past due invoices
			async.each(invoices, function(item, callback) {
				InvoicesService.pay(item)
				.then(resultInvoice => callback())
				.catch(callback);
			}, function(err) {
				if(err) return cb(err);
				cb();
			});
				
		},
		function(cb) {
			// enable branch
			BranchesService.setState({ branch: sub.branch, enabled: true }, function (err){
				if(err) return cb(err);
				cb();
			});
		},
		function(cb) {
			debug('renewSubscription branch has been activated');
			// update subscription state
			sub.state = sub.status = 'active';
			sub.save()
			.then(result => cb())
			.catch(cb);
		}
	], function (err, result){
		debug('renewSubscription subscription has been activated');
		//TODO - log the result
		if(err) return callback(err);
		callback();
	});
}

function cancel(sub, status, callback){

	async.waterfall([
		function(cb) {
			// get subscription object
			if(typeof sub === 'function') {
				logger.info('Disabling subscription: %:', sub._id.toString());
				cb(null, sub)
			} else {
				logger.info('Disabling subscription: %:', sub);

				Subscriptions.findOne({ _id: sub })
				.then(result => {
					sub = result;
					cb(null, sub);
				})
				.catch(err => cb(new Error(err)));
			}

		},
		function(sub, cb) {
			sub.status = status;
			if(status === 'past_due') sub.pastDueSince = Date.now();

			BranchesService.setState({ branch: sub.branch, enabled: false }, function(err) {
				if(err) return cb(err);
				cb(null, sub);
			});
		},
		function(sub, cb) {
			sub.save()
			.then(result => cb(null, result))
			.catch(err => cb(err));
		}

	], function(err, result) {
		if(err) {
			logger.error('cancel subscription error: %j: sub: %j', JSON.stringify(err), JSON.stringify(sub));
			if(callback) callback(err);
		} else {
			logger.info('subscription canceled: %j', sub._id.toString());
			if(callback) callback();
		}
	});
}

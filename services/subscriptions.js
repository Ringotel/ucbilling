var Subscriptions = require('../models/subscriptions');
var Invoices = require('../models/invoices');
var PlansService = require('./plans');
var AddonsService = require('./addons');
var CustomersService = require('./customers');
var BranchesService = require('./branches');
var CheckoutService = require('./checkout');
var InvoicesService = require('./invoices');
var cti = require('./cti');
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

	// if(addOns && addOns.length){
	if(addOns){
		AddonsService.get({}, '-__v -_id -createdAt -updatedAt -currency')
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
			callback(new Error(err));
		});
	} else {
		callback(null, []);
	}
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
	.lean()
	.exec()
	.then((sub) => {

		if(!sub) return callback({ name: 'ENOENT', message: 'subscription not found' });

		debug('getSubscription: ', sub);
		callback(null, sub);

	})
	.catch(err => callback(new Error(err)));
}

function getAll(params, callback) {
	Subscriptions
	.find(params)
	.populate('branch')
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

// function payInvoice(invoice) {

// 	return new Promise((resolve, reject) => {

// 		var totalAmount = Big(0),
// 			totalProrated = Big(0),
// 			creditUsed = Big(0),
// 			balance = Big(0),
// 			customer = invoice.customer;

// 		async.waterfall([
// 			function(cb) {
// 				// get customer object
// 				if(typeof customer === 'function') {
// 					cb(null, customer)
// 				} else {
// 					CustomersService.get({ _id: customer })
// 					.then(result => {
// 						customer = result;
// 						cb(null, customer);
// 					})
// 					.catch(err => cb(new Error(err)));
// 				}

// 			}, function(customer, cb) {
// 				// count payment amount
// 				balance = Big(customer.balance);

// 				invoice.items.forEach(item => {
// 					totalAmount = totalAmount.plus(item.amount);
// 					totalProrated = totalProrated.plus(item.proratedAmount || 0);
// 				});

// 				// totalAmount = totalAmount.minus(totalProrated);

// 				if(balance.gte(totalAmount)) {
// 					creditUsed = Big(totalAmount);
// 					totalAmount = Big(0);
// 				} else {
// 					totalAmount = totalAmount.minus(balance);
// 					creditUsed = balance;
// 				}

// 				debug('count payment amount: ', totalAmount.valueOf(), totalProrated.valueOf(), creditUsed.valueOf(), balance.valueOf());

// 				cb();

// 			}, function(cb) {
// 				// charge customer
// 				if(totalAmount.lte(0)) return cb(null, {});

// 				serviceParams = customer.billingDetails.filter((item) => { return (item.default && item.method === 'card') })[0];
// 				CheckoutService.stripe({
// 					amount: totalAmount.valueOf(),
// 					currency: invoice.currency,
// 					serviceParams: serviceParams
// 				})
// 				.then(transaction => cb(null, transaction))
// 				.catch(err => cb(err));

// 			}, function(transaction, cb) {
// 				// save invoice
// 				invoice.set({
// 					chargeId: transaction.chargeId,
// 					paymentSource: transaction.source,
// 					creditUsed: creditUsed.valueOf(),
// 					status: 'paid'
// 				});

// 				cb(null, invoice);

// 			}, function(invoice, cb) {
// 				// update customer
// 				if(creditUsed.lte(0) && totalProrated.lte(0)) return cb(null, invoice);

// 				let newBalance = balance.plus(totalProrated).minus(invoice.creditUsed).valueOf();

// 				debug('payInvoice new customer balance: ', newBalance);
				
// 				customer.balance = newBalance;
// 				customer.save()
// 				.then(() => {
// 					cb(null, invoice)
// 				})
// 				.catch(err => cb(new Error(err)));

// 			}

// 		], function(err, result) {
// 			if(err) return reject(err);
// 			resolve(result);
// 		});

// 	});
// }

// function cancel(sub, state) {
// 	return new Promise((resolve, reject) => {

		

// 	});
// }

function create(params, callback) {
	var newSub = {}, plan = {}, addOns = {}, customer = {};

	debug('createSubscription params: ', params);

	if(!params || !params.subscription || !params.branch) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'parameters are undefined' });

	if(!params.branch.name || !params.branch.adminname || !params.branch.adminpass) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'parameters are undefined' });

	async.waterfall([
		function(cb){
			// get customer
			CustomersService.get({ _id: params.customerId })
			.then((result) => {
				if(!result) return cb({ name: 'ENOENT', message: 'customer not found', customer: params.customerId });
				customer = result;
				cb();
			})
			.catch(err => { cb(new Error(err)) });
		},
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
			// extend addOns
			extendAddOns(params.subscription.addOns || [], function (err, result){
				if(err) return cb(err);
				addOns = result;

				debug('createSubscription addOns: %o', addOns);

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
			let nextBillingDate = null;

			if(plan.trial) {
				nextBillingDate = moment(trialExpires).add(plan.billingPeriod, plan.billingPeriodUnit);
				newSubParams.trialExpires = moment().add(plan.trialDuration, plan.trialDurationUnit).valueOf();
			} else {
				nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit);	
			}

			newSubParams.nextBillingDate = nextBillingDate.valueOf();

			newSub = new Subscriptions(newSubParams);
			newSub.validate(function(err) { debug('newSub validate err: %o', err); });
			
			debug('createSubscription subscription: %o', newSub);
			
			cb(null, newSub.countAmount());
		},
		function (amount, cb){
			// generate invoice
			let invoice = new Invoices({
				customer: customer._id,
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
			// pay invoice
			InvoicesService.pay(invoice)
			.then(resultInvoice => {
				logger.info('createSubscription payInvoice success: %j', JSON.stringify(resultInvoice));
				cb(null, resultInvoice);
			})
			.catch(err => {
				logger.error('createSubscription payInvoice error: %j invoice: %j', JSON.stringify(err), JSON.stringify(invoice));
				cb(err);
			});
		},
		function(invoice, cb) {
			invoice.save()
			.then(() => cb())
			.catch(err => { cb( new Error(err) ); } );
		},
		function (cb){
			// create new branch
			let planData = plan.customData;
			let maxlines = planData.maxlines || (newSub.quantity * planData.linesperuser);
			let storelimit = planData.storelimit || (newSub.quantity * planData.storageperuser);
			let maxusers = planData.maxusers || newSub.quantity;

			let extraLines = getAddonItem(addOns, 'lines').quantity;
			let extraStorage = getAddonItem(addOns, 'storage').quantity;

			if(extraLines) maxlines += extraLines;
			if(extraStorage) storelimit += extraStorage;

			let branchParams = {
				name: params.branch.name,
				prefix: params.branch.prefix,
				extensions: params.branch.extensions || [{ firstnumber: 1000, poolsize: 99 }],
				lang: params.branch.lang || 'en',
				maxusers: maxusers,
				maxlines: maxlines,
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

	var sub = {}, plan = {}, customer = {}, addOns = {}, cycleDays = null, proratedDays = null, subAmount = null;

	if(!params.subId || !params.planId) 
		return callback({ name: 'ERR_MISSING_ARGS', message: 'subscription or planId is undefined' });

	debug('changePlan params: %j', params);

	async.waterfall([
		function(cb){
			// get customer
			CustomersService.get({ _id: params.customerId })
			.then((result) => {
				if(!result) return cb({ name: 'ENOENT', message: 'customer not found', customer: params.customerId });
				customer = result;
				cb();
			})
			.catch(err => { 
				cb( new Error(err) );
			});
		},
		function(cb) {
			// get subscription
			Subscriptions.findOne({ customer: params.customerId, _id: params.subId })
			.populate('branch')
			.then(result => {
				if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', subId: params.subId });
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
			if(sub.plan.planId === plan.planId || plan.numId === 0 || plan.planId === 'trial') 
				return cb({ name: 'ECANCELED', message: 'can\'t change plan', planId: plan.planId });
			
			cb();
		},
		function(cb) {
			// update subscription
			
			cycleDays = moment(sub.nextBillingDate).diff(moment(sub.prevBillingDate), 'days');
			proratedDays = moment(sub.nextBillingDate).diff(moment(), 'days');
			subAmount = Big(sub.amount);

			// if new plan with different billing period
			if(sub.plan.trialPeriod || sub.plan.billingPeriod !== plan.billingPeriod || sub.plan.billingPeriodUnit !== plan.billingPeriodUnit) {
				sub.nextBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit).valueOf();
				sub.prevBillingDate = Date.now();
			} else {
				subAmount = subAmount.times(Big(proratedDays).div(cycleDays));
			}

			debug('changePlan update sub: ', cycleDays, proratedDays, subAmount.valueOf());

			// change plan after counting 
			// cycleDays, proratedDays, subAmount 
			// and determining nextBillingDate and prevBillingDate
			sub.plan = plan;
			sub.description = 'Subscription for '+plan.name+' plan'; // TODO: generate description

			debug('changePlan sub: %j', sub);

			cb(null, sub.countAmount());
		},
		function (amount, cb){
			// calculate proration and generate invoice
			
			let proratedAmount = Big(0);
			let chargeAmount = Big(amount).times(Big(proratedDays).div(cycleDays));

			if(chargeAmount.gte(subAmount)) {
				chargeAmount = chargeAmount.minus(subAmount);
			} else {
				proratedAmount = subAmount.minus(chargeAmount);
				chargeAmount = Big(0);
			}

			let invoice = new Invoices({
				customer: customer._id,
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
			.then(resultInvoice => {
				logger.info('payInvoice success: %j', JSON.stringify(resultInvoice));
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
			let planData = plan.customData;
			let maxlines = planData.maxlines || (sub.quantity * planData.linesperuser);
			let storelimit = planData.storelimit || (sub.quantity * planData.storageperuser);
			let maxusers = planData.maxusers || sub.quantity;

			let extraLines = getAddonItem(sub.addOns, 'lines').quantity;
			let extraStorage = getAddonItem(sub.addOns, 'storage').quantity;

			if(extraLines) maxlines += extraLines;
			if(extraStorage) storelimit += extraStorage;

			let requestParams = {
				sid: sub.branch.sid,
				data: {
					method: 'updateBranch',
					params: {
						maxusers: maxusers,
						maxlines: maxlines,
						storelimit: utils.convertBytes(storelimit, 'GB', 'Byte'),
						config: planData.config	
					}
				}
			};

			debug('changePlan updateBranch: %o', requestParams);
			cti.request(requestParams, function (err, result){
				debug('changePlan cti.request: %o', err, result);
				if(err) return cb(err);
				cb(null, sub);
			});
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

function renew(params, callback){
	debug('renewSubscription params: ', params);

	if(!params.subId) return callback({ name: 'ERR_MISSING_ARGS', message: 'subId is undefined' });

	var customer = {}, sub = {};

	async.waterfall([
		function(cb){
			// get customer
			CustomersService.get({ _id: params.customerId })
			.then((result) => {
				if(!result) return cb({ name: 'ENOENT', message: 'customer not found', customer: params.customerId });
				customer = result;
				cb();
			})
			.catch(err => cb(err));
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
				customer: customer._id,
				subscription: sub._id,
				currency: sub.plan.currency,
				items: [{
					description: sub.description,
					amount: sub.amount
				}]
			});

			cb(null, invoice);
		},
		function(invoice, cb) {
			// pay invoice
			InvoicesService.pay(invoice)
			.then(resultInvoice => {
				logger.info('payInvoice success: %j', JSON.stringify(resultInvoice));
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

			if(sub.plan.planId === 'trial' || sub.plan.planId === 'free' || sub.state === 'canceled') {
				return cb({ name: 'ECANCELED', message: 'can\'t renew subscription' });
			}

			sub.nextBillingDate = moment().add(sub.plan.billingPeriod, sub.plan.billingPeriodUnit).valueOf();
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
var config = require('../env/index');
var Subscriptions = require('../models/subscriptions');
var Customers = require('../models/customers');
var Branches = require('../models/branches');
var Charges = require('../services/charges');
var BranchesService = require('../services/branches');
var CustomersService = require('../services/customers');
var SubscriptionsService = require('../services/subscriptions');
var CheckoutService = require('../services/checkout');
var Transactions = require('../services/transactions');
var async = require('async');
var Big = require('big.js');
var moment = require('moment');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var logger = require('../modules/logger').jobs;
var winston = require('winston');
var jobs = require('../jobs');

mongoose.connect(config.bdb, { useMongoClient: true });
mongoose.Promise = global.Promise;

module.exports = function(agenda) {
	agenda.define('charge', { lockLifetime: 5000, concurrency: 1, priority: 'high' }, chargeJob);
};

function chargeJob(job, done){
	Customers.find({ state: 'active' })
	.then(processCustomers)
	.then(() => {
		logger.info('All customers charged');
		done();
	})
	.catch((err) => {
		logger.error('chargeJob error: %j', err);
		done(err);
	});
}

function processCustomers(customers){

	return new Promise((resolve, reject) => {
		async.each(customers, function (customer, cb){

			Subscriptions.find({ customerId: customer._id, state: 'active' })
			.populate('_branch')
			.exec()
			.then(subs => processSubscriptions(customer, subs))
			.then((params) => chargeCustomer(customer, params.currentBalance, params.order))
			.then((order) => handleOrder(customer, order))
			.then(() => cb())
			.catch(err => cb(err));

			
		}, function (err){
			if(err) return reject(err);
			resolve();
		});
	});
}

function processSubscriptions(customer, subs){

	return new Promise((resolve, reject) => {

		var totalAmount = Big(0),
			prevBalance = Big(0),
			currentBalance = Big(customer.balance),
			order = [];

		logger.info('Customer %s has %s active subscriptions', customer.email, subs.length);

		async.each(subs, function (sub, cb){
			
			logger.info('Start processing subscription: ', sub._id);

			processSubscription(sub, customer, function(newSub, billingAmount, orderObject) {
				
				if(!newSub) return cb();

				newSub.save(function(err) {

					if(err) return cb(err);

					logger.info('Customer '+customer.email+'. Subscription '+newSub._id.valueOf()+' updated');
					logger.info('Customer '+customer.email+'. Billing Cycle: '+newSub.currentBillingCycle);
					
					totalAmount = totalAmount.plus(billingAmount);
					prevBalance = Big(currentBalance);
					currentBalance = currentBalance.minus(billingAmount);
					if(orderObject) order.push(orderObject);

					// save new charge if subscription amout greater than 0
					if(Big(billingAmount).gt(0)) {
						var chargeData = {
							customerId: customer._id,
							description: newSub.description,
							balance: currentBalance.valueOf(),
							prevBalance: prevBalance.valueOf(),
							amount: billingAmount.valueOf(),
							currency: newSub.currency,
							// _branch: newSub._branch._id,
							_subscription: newSub._id
						};

						Charges.add(chargeData, function(err, chargeResult) {
							if(err) logger.error('New charge error: %j, data: %j', err, chargeData);
							else logger.info('New charge: %j', chargeData);
							cb();
						});
					}

				});

			});

		}, function(err) {

			logger.info('Customer %s. Subscriptions totalAmount: %s%s', customer.email, totalAmount.valueOf(), customer.currency);
			
			if(err) return reject(err);
			resolve({ currentBalance, order });

		});
	});
}

function processSubscription(sub, customer, callback) {

	var branch = sub._branch,
		nextAmount = Big(0),
		proceed = true,
		diff = null,
		overdue = null,
		billingCyclesLeft,
		lastBillingDate,
		order;

	// Return if subscription was already billed today
	// TEST
	// if(sub.prevBillingDate && moment().isSame(sub.prevBillingDate, 'day')) {
	// 	logger.info('Customer '+customer.email+': Subscription '+sub._id+': SUBSCRIPTION_IS_BILLED');
	// 	proceed = false;
	// }
	// Return if nextBillingDate is the future date
	if(moment().isBefore(sub.nextBillingDate, 'day')) {
		logger.info('Customer '+customer._id+': Subscription '+sub._id+': NON_BILLING_DATE');
		proceed = false;

	} else {
		overdue = moment().diff(sub.prevBillingDate, 'days');
		if(overdue > 1) // TODO: notify administrator
			logger.info('Customer '+customer._id+': Subscription '+sub._id+': MISSED_BILLING_DATE '+overdue+' times');
	}

	if(!proceed) return callback();

	sub.nextBillingDate = moment(sub.nextBillingDate).add(1, 'd').valueOf();
	sub.prevBillingDate = Date.now();

	if(sub.trialPeriod) {
		// if trial period expires - deactivate trial period
		if(moment().isSameOrAfter(sub.trialExpires, 'day')) {
			// sub.trialPeriod = false;
			logger.info('Customer '+customer._id+'. Trial expired for subscription '+sub._id);
			pauseBranch({customerId: customer._id, oid: branch.oid}, 'expired');
			sub.expiredSince = Date.now();
			jobs.now('trial_expired', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix });
			
		} else if(moment(sub.trialExpires).diff(moment(), 'days') === 10) {
			jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: 10 });
			
		} else if(moment(sub.trialExpires).diff(moment(), 'days') === 1) {
			jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: 1 });

		}

		return callback(sub, nextAmount);
	}

	// if trial period is false and billing cyrles greater or equal to subscription billing cyrles
	if(sub.currentBillingCycle >= sub.billingCycles){

		if(sub.chargeTries < sub.maxChargeTries) {
			sub.chargeTries++;
			order = {
				action: 'renewSubscription',
				description: sub.description,
				amount: sub.amount,
				data: {
					customerId: customer._id,
					oid: branch.oid
				}
			};
			logger.info('Customer: %s. Subscription: %s. New order: %j', customer._id, sub._id, order);
		} else {
			pauseBranch({customerId: customer._id, oid: branch.oid}, 'expired');
			sub.expiredSince = Date.now();
			jobs.now('subscription_expired', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix });
		}

	} else {
		
		billingCyclesLeft = sub.billingCycles - sub.currentBillingCycle;
		// Notify customer
		if(billingCyclesLeft === 10) jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: billingCyclesLeft });
		else if(billingCyclesLeft === 1) jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: billingCyclesLeft });
	}
		
	nextAmount = Big(sub.nextBillingAmount);
	if(overdue && overdue > 1) nextAmount = nextAmount.times(overdue);
	sub.currentBillingCycle += 1;
	logger.info('Customer '+customer.email+'. Subscription '+sub._id+' nextAmount is '+nextAmount.valueOf()+''+customer.currency);

	callback(sub, nextAmount, order);

}

function chargeCustomer(customer, currentBalance, order) {

	return new Promise((resolve, reject) => {

			var order_id = moment().unix().toString();
			var serviceParams = customer.billingDetails.filter((item) => { return (item.default && item.method === 'card') })[0];
			var orderAmount = 0;

			winston.info('chargeCustomer %s. Order: %j', customer._id order);

			async.waterfall([
				function(cb) {
					if(!order || !order.length) return cb();

					orderAmount = order.reduce((prev, next) => { return prev.plus(next.amount); }, Big(0)).minus(currentBalance);

					logger.info('chargeCustomer %s, orderAmount: %s, serviceParams: %j', customer.email, orderAmount, serviceParams);

					CheckoutService.stripe({
						amount: orderAmount.toFixed(2).valueOf() * 100,
						currency: customer.currency,
						serviceParams: serviceParams
					})
					.then((transaction) => {
						currentBalance = currentBalance.plus(orderAmount);

						transaction.customerId = customer._id;
						transaction.description = (order.length > 1 ? ('Ringotel Service Payment. Order ID: '+order_id) : order[0].description);
						transaction.order_id = order_id;
						transaction.payment_method = serviceParams.method;
						transaction.payment_service = serviceParams.service;
						transaction.order = order;
						transaction.balance_before = currentBalance.minus(orderAmount);
						transaction.balance_after = currentBalance;

						logger.info('chargeCustomer %s. Add transaction: %j', customer._id, transaction);

						Transactions.add(transaction, function(err) {
							if(err) logger.info('chargeCustomer %s. Add transaction failed: %j', customer._id, err);
						});

						cb();
					})
					.catch(function(err) {
						debug('chargeCustomer %s. Checkout catch: ', customer._id, err);
						cb(err);
					});
				},
				function(cb) {
					setCustomerBalance(customer, currentBalance)
					.then(function() { cb(); })
					.catch(function(err) { 
						debug('chargeCustomer %s. setCustomerBalance catch: ', customer._id, err);
						cb(err); 
					});
				}
			], function(err) {
				if(err) {
					winston.log('info', 'CHECKOUT_FAILED. Customer: %s. Reason: %s. Order: %j', customer._id, err, order);
					return resolve([]);
				}
				winston.info('Customer %s charged: %s', customer._id, orderAmount);
				resolve(order);
			});

		});
}

function setCustomerBalance(customer, newBalance){

	var prevBalance = Big(customer.balance);

	// Once customer balance drops below 0 - send notification
	if(prevBalance.gte(customer.creditLimit) && newBalance.lt(customer.creditLimit)){
		// !!TODO: Send Notification if Balance is Under allowed credit limit
		customer.pastDueDate = moment().valueOf();
		jobs.now('past_due', { lang: customer.lang, name: customer.name, email: customer.email, balance: newBalance.valueOf(), currency: customer.currency });
		logger.info('Customer %s balance drops below 0 and now equals: %', customer._id, newBalance.valueOf());
	} else if(newBalance.eq(0)) {
		// !!TODO: Send Notification if Balance is 0
		logger.info('Customer %s balance drops to 0 and now equals: %', customer._id, newBalance.valueOf());
	}

	// set new customer balance
	customer.balance = newBalance.valueOf();
	return customer.save();
}

function handleOrder(customer, order) {
	return new Promise((resolve, reject) => {
		if(!order || !order.length) resolve();

		CheckoutService.handleOrder(customer._id, order, function(err) {
			if(err) return reject(err);
			resolve();
		});
	});
}

function pauseBranch(branchParams, state){
	logger.info('Pausing branch '+branchParams.oid+'. Pausing state '+state);

	return true; // TEST

	BranchesService.setBranchState({ customerId: branchParams.customerId, _id: branchParams._id }, {
		method: 'setBranchState',
		state: state,
		enabled: false
	}, function (err){
		if(err) {
			//TODO - log error
			//TODO - create job
			logger.error('ERROR: %. Branch: %s. Reason: %j', 'PAUSE_BRANCH', branchParams.oid, err);
		} else {
			//TODO - inform user
			logger.info('Branch % paused', branchParams.oid);
			
		}
	});
}
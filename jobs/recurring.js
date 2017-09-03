var config = require('../env/index');
var Subscriptions = require('../models/subscriptions');
var Customers = require('../models/customers');
var ChargesService = require('../services/charges');
var BranchesService = require('../services/branches');
var CheckoutService = require('../services/checkout');
var TransactionsService = require('../services/transactions');
var async = require('async');
var Big = require('big.js');
var moment = require('moment');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var logger = require('../modules/logger').jobs;
var jobs = require('../jobs');

mongoose.connect(config.bdb, { useMongoClient: true });
mongoose.Promise = global.Promise;

module.exports = function(agenda) {
	agenda.define('recurring', { lockLifetime: 5000, concurrency: 1, priority: 'high' }, recurringJob);
};

function recurringJob(job, done){
	Customers.find({ state: 'active' })
	.then(processCustomers)
	.then(() => {
		logger.info('All customers charged');
		done();
	})
	.catch((err) => {
		logger.error('recurringJob error: %j', err);
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
			.then((result) => cb())
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

		logger.info('Customer %s has %s active subscriptions', customer._id, subs.length);

		async.each(subs, function (sub, cb){
			
			logger.info('Start processing subscription: %s', sub._id.toString());

			processSubscription(sub, customer, function(newSub, billingAmount, orderObject) {
				
				if(!newSub) return cb();

				newSub.save()
				.then(function(result) {

					logger.info('Customer '+customer._id+'. Subscription '+result._id.valueOf()+' updated');
					logger.info('Customer '+customer._id+'. Billing Cycle: '+result.currentBillingCycle);
					
					totalAmount = totalAmount.plus(billingAmount);
					prevBalance = Big(currentBalance);
					currentBalance = currentBalance.minus(billingAmount);
					if(orderObject) order.push(orderObject);

					// save new charge if subscription amout greater than 0
					if(Big(billingAmount).gt(0)) {
						var chargeData = {
							customerId: customer._id,
							subId: result._id,
							description: result.description,
							balance: currentBalance.valueOf(),
							prevBalance: prevBalance.valueOf(),
							amount: billingAmount.valueOf(),
							currency: result.currency
						};

						ChargesService.add(chargeData, function(err, chargeResult) {
							if(err) logger.error('New charge error: %j, data: %j', JSON.stringify(err), JSON.stringify(chargeData));
							else debug('New charge: %o', chargeData);
							cb();
						});
					}

				})
				.catch(err => cb(err));

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
		nextAmount = Big(sub.nextBillingAmount),
		proceed = true,
		overdue = 0,
		// billingCyclesLeft = null,
		order = null;

	// Return if subscription was already billed today
	// if(sub.prevBillingDate && moment().isSame(sub.prevBillingDate, 'day')) { // TEST
	// 	logger.info('Customer '+customer.email+': Subscription '+sub._id+': SUBSCRIPTION_IS_BILLED');
	// 	proceed = false;
	// }
	// Return if nextBillingDate is the future date
	// if(moment().isBefore(sub.nextBillingDate, 'day')) {
	// 	logger.info('Customer '+customer._id+': Subscription '+sub._id+': NON_BILLING_DATE');
	// 	proceed = false;

	// } else {
	// 	overdue = moment().diff(sub.prevBillingDate, 'days');
	// 	if(overdue > 1) // TODO: notify administrator
	// 		logger.info('Customer '+customer._id+': Subscription '+sub._id+': MISSED_BILLING_DATE '+overdue+' times');
	// } // TEST

	if(!proceed) return callback();

	if(overdue && overdue > 1) nextAmount = nextAmount.times(overdue);

	sub.nextBillingDate = moment(sub.nextBillingDate).add(1, 'd').valueOf();
	sub.prevBillingDate = Date.now();
	sub.currentBillingCycle += 1;

	if(sub.trialPeriod) {
		// if trial period expires - deactivate trial period
		if(moment().isSameOrAfter(sub.trialExpires, 'day')) {
			// sub.trialPeriod = false;
			logger.info('Customer '+customer._id+'. Trial expired for subscription '+sub._id);
			sub.state = 'past_due';
			sub.pastDueSince = Date.now();
			disableBranch(branch);
			jobs.now('trial_expired', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix });
			
		} else if(moment(sub.trialExpires).diff(moment(), 'days') === 10) {
			jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: 10 });
			
		} else if(moment(sub.trialExpires).diff(moment(), 'days') === 1) {
			jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: 1 });

		}

		return callback(sub, 0);
	}

	// if trial period is false and billing cyrles greater or equal to subscription billing cyrles
	if(sub.currentBillingCycle >= sub.billingCycles){

		if(sub.chargeTries < sub.maxChargeTries) {
			sub.chargeTries++;
			order = {
				action: 'renew',
				description: sub.description,
				amount: sub.amount,
				data: {
					customerId: customer._id,
					subId: sub._id
				}
			};
			logger.info('Customer: %s. Subscription: %s. New order: %j', customer._id, sub._id, JSON.stringify(order));
		} else {
			sub.state = 'past_due';
			sub.pastDueSince = Date.now();
			disableBranch(branch);
			jobs.now('subscription_expired', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix });
		}

	}
	// else {
		
	// 	billingCyclesLeft = sub.billingCycles - sub.currentBillingCycle;
	// 	// Notify customer
	// 	if(billingCyclesLeft === 10) jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: billingCyclesLeft });
	// 	else if(billingCyclesLeft === 1) jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: billingCyclesLeft });
	// }

	logger.info('Customer '+customer.email+'. Subscription '+sub._id+' nextAmount is '+nextAmount.valueOf()+' '+customer.currency);

	callback(sub, nextAmount, order);

}

function chargeCustomer(customer, currentBalance, order) {

	return new Promise((resolve, reject) => {

			if(!order || !order.length) return resolve(currentBalance);

			var order_id = moment().unix().toString();
			var serviceParams = customer.billingDetails.filter((item) => { return (item.default && item.method === 'card') })[0];
			var orderAmount;
			var checkoutAmount;

			logger.info('chargeCustomer %s. Order: %j', customer._id, JSON.stringify(order));

			async.waterfall([
				function(cb) {

					orderAmount = order.reduce((prev, next) => { return prev.plus(next.amount); }, Big(0));
					checkoutAmount = orderAmount.gt(currentBalance) ? orderAmount.minus(currentBalance) : Big(0);

					cb();
				},
				function(cb) {
					if(checkoutAmount.lte(0)) return cb(null, { amount: 0 });

					debug('chargeCustomer %s, orderAmount: %s, serviceParams: %o', customer.email, checkoutAmount.valueOf(), serviceParams);

					CheckoutService.stripe({
						amount: checkoutAmount.valueOf(),
						currency: customer.currency,
						serviceParams: serviceParams
					}, function(err, transaction) {
						if(err) {
							logger.error('chargeCustomer %s. Checkout catch: %j', customer._id.toString(), JSON.stringify(err));
							return cb(err);
						}
						cb(null, transaction);

					});
				},
				function(transaction, cb) {

					currentBalance = currentBalance.plus(transaction.amount);

					transaction.customerId = customer._id;
					transaction.description = (order.length > 1 ? ('Ringotel Service Payment. Order ID: '+order_id) : order[0].description);
					transaction.order_id = order_id;
					transaction.payment_method = serviceParams.method;
					transaction.payment_service = serviceParams.service;
					transaction.order = order;
					transaction.balance_before = currentBalance.minus(orderAmount);
					transaction.balance_after = currentBalance;

					debug('chargeCustomer %s. Add transaction: %o', customer._id, transaction);

					TransactionsService.add(transaction, function(err) {
						if(err) logger.info('chargeCustomer %s. Add transaction failed: %j', customer._id, JSON.stringify(err));
					});

					cb(null, currentBalance);
				}
				// function(cb) {
				// 	debug('setCustomerBalance: ', customer._id, currentBalance);
				// 	setCustomerBalance(customer, currentBalance)
				// 	.then(() => cb())
				// 	.catch(err => { 
				// 		logger.error('chargeCustomer %s. setCustomerBalance catch: %j', customer._id.toString(), JSON.stringify(err));
				// 		cb(err); 
				// 	});
				// }
			], function(err) {
				if(err) {
					logger.error('CHECKOUT_FAILED. Customer: %s. Reason: %j. Order: %j', customer._id.toString(), JSON.stringify(err), JSON.stringify(order));
					return resolve([]);
				}
				logger.info('Customer %s charged: %s', customer._id.toString(), orderAmount.valueOf());
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
		logger.info('Customer %s balance drops below 0 and now equals: %', customer._id.toString(), newBalance.valueOf());
	} else if(newBalance.eq(0)) {
		// !!TODO: Send Notification if Balance is 0
		logger.info('Customer %s balance drops to 0 and now equals: %', customer._id.toString(), newBalance.valueOf());
	}

	// set new customer balance
	customer.balance = newBalance.valueOf();

	debug('setCustomerBalance: ', customer._id, newBalance.valueOf());

	return customer.save();
}

function handleOrder(customer, order) {
	return new Promise((resolve, reject) => {
		if(!order || !order.length) resolve();

		CheckoutService.handleOrder(customer._id, order, function(err, result) {
			if(err) return reject(err);
			resolve(result);
		});
	});
}

function disableBranch(branch, callback){
	logger.info('Disabling branch: %j:', branch);

	return logger.info('Branch %j disabled', branch.oid); // TEST

	BranchesService.setState({ branch: branch, enabled: false }, function (err){
		if(err) {
			//TODO - log error
			//TODO - create job
			logger.error('disableBranch error: %j: branch: %j', JSON.stringify(err), JSON.stringify(branch));
		} else {
			//TODO - inform user
			logger.info('Branch %j disabled', branch.oid);
			
		}
	});
}
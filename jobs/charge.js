var Subscription = require('../models/subscriptions');
var Customers = require('../models/customers');
var Charges = require('../services/charges');
var Big = require('big.js');
var Branches = require('../models/branches');
var BranchesService = require('../services/branches');
var moment = require('moment');
var config = require('../env/index');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var async = require('async');
var logger = require('../modules/logger').jobs;
var jobs = require('../jobs');

mongoose.connect(config.bdb);

function setCustomerBalance(customer, amount, cb){

	var prevBalance = Big(customer.balance);
	var newBalance = prevBalance.minus(amount);

	// Once customer balance drops below 0 - send notification
	if(prevBalance.gte(customer.creditLimit) && newBalance.lt(customer.creditLimit)){
		// !!TODO: Send Notification if Balance is Under allowed credit limit
		customer.pastDueDate = moment().valueOf();
		jobs.now('past_due', { lang: customer.lang, name: customer.name, email: customer.email, balance: newBalance.valueOf(), currency: customer.currency });
		logger.info('Customer % balance drops below 0 and now equals: %', customer.email, newBalance);
	} else if(newBalance.eq(0)) {
		// !!TODO: Send Notification if Balance is 0
		logger.info('Customer % balance drops to 0 and now equals: %', customer.email, newBalance);
	}

	// set new customer balance
	customer.balance = newBalance.valueOf();

	customer.save(function (err, result){
		if(err){
			logger.error(err);
			// debug('customer save error', err);
			cb(err);
		} else {
			cb(null, cb);

			Charges.add({
				customerId: customer._id,
				balance: result.balance,
				prevBalance: prevBalance,
				amount: amount.valueOf(),
				currency: result.currency
			}, function (err, chargeResult){
				if(err) {
					logger.error(err);
					return; //TODO - handle error
				}
			});

			// debug('customer id: %s, new balance: %s', customer.id, customer.balance);
		}
	});
}

function pauseBranch(branchParams, state){
	BranchesService.setBranchState({
		method: 'setBranchState',
		state: state,
		customerId: branchParams.customerId,
		result: {
			oid: branchParams.oid,
			enabled: false
		}
	}, function (err){
		if(err) {
			//TODO - log error
			//TODO - create job
			logger.error(err);
		} else {
			//TODO - inform user
		}
	});
}

function processSubscription(branch, customer, cb) {

	var sub = branch._subscription,
		subAmount = Big(0),
		process = true,
		diff = null,
		lastBillingDate;

	// Return if subscription was already billed today
	if(sub.prevBillingDate && moment().isSame(sub.prevBillingDate, 'day')) {
		logger.info('Customer '+customer.email+': Subscription '+sub._id+': SUBSCRIPTION_IS_BILLED');
		process = false;
	}
	// Return if nextBillingDate is the future date
	if(moment().isBefore(sub.nextBillingDate, 'day')) {
		logger.info('Customer '+customer.email+': Subscription '+sub._id+': NON_BILLING_DATE');
		process = false;

	} else {
		diff = moment().diff(sub.prevBillingDate, 'days');
		if(diff > 1) // TODO: notify administrator
			logger.info('Customer '+customer.email+': Subscription '+sub._id+': MISSED_BILLING_DATE '+diff+' times');
	}

	if(process) {
		if(sub.trialPeriod) {
			// if trial period expires - deactivate trial period
			if(moment().isSame(sub.trialExpires, 'day')) {
				sub.trialPeriod = false;
				logger.info('Customer '+customer.email+'. Trial expired for subscription '+sub._id);
			}
		} else {
			subAmount = subAmount.plus(sub.nextBillingAmount);
			if(diff && diff > 1) subAmount = subAmount.plus(Big(sub.nextBillingAmount).times(diff));
			
			logger.info('Customer '+customer.email+'. Subscription '+sub._id+' subAmount is '+subAmount.valueOf()+''+customer.currency);
			logger.info('Customer '+customer.email+'. CurrentBillingCyrcle: '+sub.currentBillingCyrcle+'. BillingCyrcles: '+sub.billingCyrcles);
		}
		
		// if trial period is false and billing cyrles greater or equal to subscription billing cyrles
		if(!sub.trialPeriod && sub.currentBillingCyrcle >= sub.billingCyrcles){

			if(!sub.neverExpires){
				pauseBranch({customerId: customer._id, oid: branch.oid}, 'expired');
				jobs.now('subscription_expired', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix });
				logger.info('Customer '+customer.email+'. Pause Branch: '+branch.oid);

			} else {
				// subscription continues to charge
				lastBillingDate = moment().add(sub.billingPeriod, sub.billingPeriodUnit);

				sub.lastBillingDate = lastBillingDate.valueOf();
				sub.billingCyrcles = (lastBillingDate.diff(moment(), 'days')) + 1;
				// sub.nextBillingAmount = Big(sub.amount).div(sub.billingCyrcles).toString(); // set the next billing amount for the new circle

				// reset billing circles
				sub.currentBillingCyrcle = 1;
				logger.info('Customer '+customer.email+'. Subscription '+sub._id+' neverExpires. New billing cyrcle: '+sub.currentBillingCyrcle);
			}
		} else {
			sub.currentBillingCyrcle += 1;

			lastBillingDate = moment(sub.lastBillingDate);
			diff = sub.billingCyrcles - sub.currentBillingCyrcle;
			// diff = lastBillingDate.diff(moment(), 'days');

			if(!sub.neverExpires) {
				// Notify customer
				if(diff === 10) jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: 10 });
				else if(diff === 1) jobs.now('subscription_expires', { lang: customer.lang, name: customer.name, email: customer.email, prefix: branch.prefix, expDays: 1 });
			}
		}

		sub.nextBillingDate = moment(sub.nextBillingDate).add(1, 'd').valueOf();
		sub.prevBillingDate = Date.now();

		cb(sub, subAmount);
	} else {
		cb();
	}

}

module.exports = function(agenda){
	agenda.define('charge', { lockLifetime: 5000, concurrency: 1, priority: 'high' }, function(job, done){

		Customers.find({}, function (err, customers){

			if(err) {
				done(err);
				return;
			}

			// var lastBillingDate,
			// 	activeBranches,
			// 	totalAmount,
			// 	process,
			// 	diff,
			// 	sub;

			function isActiveSubscription(branch){
				return branch._subscription.state === 'active';
			}

			async.each(customers, function (customer, cb1){

				Branches.find({customerId: customer._id})
				.populate('_subscription')
				.exec(function (err, branches){
					
					if(err) {
						//TODO - log error
						//TODO - create job
						logger.error(err);
						return cb1();
					}

					var totalAmount = Big(0),

					//remove unactive subscriptions from array
					activeBranches = branches.filter(isActiveSubscription);

					logger.info('Customer %s has %s active subscriptions: ', customer.email, activeBranches.length);

					async.each(activeBranches, function (branch, cb2){
						
						processSubscription(branch, customer, function(newSub, subAmount) {
							
							if(!newSub) return cb2();

							newSub.save(function(err, result){
								if(err){
									//TODO - log error
									//TODO - create job
									logger.error('Subscription '+newSub._id+' saving error: ');
									logger.error(err);

									cb2();
								} else {
									logger.info('Customer '+customer.email+'. Subscription '+newSub._id.valueOf()+' updated');
									logger.info('Customer '+customer.email+'. Billing cyrcle: '+newSub.currentBillingCyrcle);
									
									totalAmount = totalAmount.plus(subAmount);
									cb2();
								}
							});

						});

					}, function() {

						logger.info('Customer %s. Subscriptions totalAmount: %s%s', customer.email, totalAmount.valueOf(), customer.currency);
						if(totalAmount.gt(0)) {
							setCustomerBalance(customer, totalAmount, function (err){
								if(err) {
									//TODO - log the error
									//TODO - create job
									logger.error(err);
									cb1();
								} else {
									logger.info('Customer %s: charged for %s%s, new balance is: %s%s', customer.email, totalAmount.valueOf(), customer.currency, customer.balance, customer.currency);
									cb1();
								}
							});
						} else {
							cb1();
						}

					});
				});
			}, function (err){
				if(err) {
					//TODO - log the error
					//TODO - create job
					logger.error(err);
					done(err);
				} else {
					logger.info('All customers charged');
					done();
				}
			});
		});
	});
};

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

mongoose.connect(config.bdb);

function setCustomerBalance(customer, amount, cb){

	var prevBalance = Big(customer.balance);
	var newBalance = prevBalance.minus(amount);

	// Once customer balance drops below 0 - send notification
	if(prevBalance.gte(customer.creditLimit) && newBalance.lt(customer.creditLimit)){
		// !!TODO: Send Notification if Balance is Under allowed credit limit
		customer.pastDueDate = moment().valueOf();
		logger.info('% balance drops below 0 and now equals: %', customer.email, newBalance);
	} else if(newBalance.eq(0)) {
		// !!TODO: Send Notification if Balance is 0
		logger.info('% balance drops to 0 and now equals: %', customer.email, newBalance);
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

function isActiveSubscription(branch){
	return branch._subscription.state === 'active';
}

module.exports = function(agenda){
	agenda.define('charge_subscriptions', { lockLifetime: 5000, concurrency: 1, priority: 'high' }, function(job, done){

		Customers.find({}, function (err, customers){

			if(err) {
				done(err);
				return;
			}

			var lastBillingDate,
				activeBranches,
				totalAmount,
				process,
				diff,
				sub;

			async.each(customers, function (customer, cb1){
				debug('each customer: ', customer._id );
				Branches.find({customerId: customer._id})
				.populate('_subscription')
				.exec(function (err, branches){
					debug('each exec: ', branches.length);
					if(err) {
						//TODO - log error
						//TODO - create job
						logger.error(err);
						return cb1();
					}

					//remove unactive subscriptions from array
					activeBranches = branches.filter(isActiveSubscription);
					totalAmount = Big(0);

					logger.info('Customer %s has %s active subscriptions: ', customer.email, activeBranches.length);

					//charge active subscriptions
					async.each(activeBranches, function (branch, cb2){

						sub = branch._subscription;
						process = true;
						diff = null;

						// Return if subscription was already billed today
						if(sub.prevBillingDate && moment().isSame(sub.prevBillingDate, 'day')) {
							logger.info('Subscription '+sub._id+': SUBSCRIPTION_IS_BILLED');
							process = false;
						}
						// Return if nextBillingDate is not today
						if(moment().isSame(sub.nextBillingDate, 'day') === false) {
							logger.info('Subscription '+sub._id+': NON_BILLING_DATE');
							process = false;
						}

						if(moment().isAfter(sub.nextBillingDate, 'day')) {
							// TODO: notify administrator
							diff = moment().diff(sub.nextBillingDate, 'days');
							logger.info('Subscription '+sub._id+': MISSED_BILLING_DATE '+diff+' times');
						}

						if(process) {
							if(sub.trialPeriod) {
								// trial period expires - deactivate trial period
								if(moment().valueOf() > sub.trialExpires) {
									sub.trialPeriod = false;
									// TODO: send notification to user!
								}
							} else {
								totalAmount = totalAmount.plus(sub.nextBillingAmount);
								if(sub.currentBillingCyrcle >= sub.billingCyrcles){

									// !!TODO: Send notification to the user that his subscription expired
									if(!sub.neverExpires){

										pauseBranch({customerId: customer._id, oid: branch.oid}, 'expired');

									} else {
										// subscription continues to charge
										lastBillingDate = moment().add(sub.billingPeriod, sub.billingPeriodUnit).add(1, 'd');

										sub.lastBillingDate = lastBillingDate.valueOf();
										sub.billingCyrcles = lastBillingDate.diff(moment(), 'days');
										// sub.nextBillingAmount = Big(sub.amount).div(sub.billingCyrcles).toString(); // set the next billing amount for the new circle

										// reset billing circles
										sub.currentBillingCyrcle = 1;
										debug('new billing cyrcle: ', sub);
									}
								} else {
									sub.currentBillingCyrcle += 1;
								}
							}

							sub.nextBillingDate = moment(sub.nextBillingDate).add(1, 'd').valueOf();
							sub.prevBillingDate = Date.now();

							sub.save(function(err, result){
								if(err){
									//TODO - log error
									//TODO - create job
									logger.error(err);
									cb2();
								} else {
									logger.info('Subscription %s updated for customer: %s', sub._id.valueOf(), customer.email);
									logger.info('New billing cyrcle: %s', sub.currentBillingCyrcle);
									cb2();
								}
							});
						} else {
							cb2();
						}

					}, function (err){
						if(err) return cb1(err);
						logger.info('Customer %s subscriptions totalAmount: %s', customer.email, totalAmount.valueOf());
						if(totalAmount.gt(0)) {
							setCustomerBalance(customer, totalAmount, function (err){
								if(err) {
									//TODO - log the error
									//TODO - create job
									logger.error(err);
									cb1();
								} else {
									cb1();
									logger.info('Customer %s charged for %s%s, new balance is: %s', customer.email, totalAmount.valueOf(), customer.currency, customer.balance);
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

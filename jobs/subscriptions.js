// var Subscriptions = require('../models/subscriptions');
var Customers = require('../models/customers');
var Charges = require('../services/charges');
var Big = require('big.js');
var Branches = require('../models/branches');
var moment = require('moment');
var config = require('../env/index');
// var config = require('../config/server');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var async = require('async');
var apiCtrl = require('../controllers/api');

mongoose.connect(config.bdb);

function setCustomerBalance(customer, amount, cb){

	var prevBalance = Big(customer.balance);
	var newBalance = prevBalance.minus(amount);

	// Once customer balance drops below 0 - send notification
	if(prevBalance.gte(customer.creditLimit) && newBalance.lt(customer.creditLimit)){
		// !!TODO: Send Notification if Balance is Under allowed credit limit
		customer.pastDueDate = moment().valueOf();
	}

	// set new customer balance
	customer.balance = newBalance.valueOf();

	customer.save(function (err, result){
		if(err){
			// debug('customer save error', err);
			cb(err);
		} else {
			cb(null, cb);

			Charges.add({
				customerId: customer._id,
				balance: result.balance,
				prevBalance: prevBalance,
				amount: amount,
				currency: result.currency
			}, function (err, chargeResult){
				if(err) {
					return; //TODO - handle error
				}
			});

			// debug('customer id: %s, new balance: %s', customer.id, customer.balance);
		}
	});
}

function pauseBranch(branchParams, state){
	apiCtrl.setBranchState({
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
		} else {
			//TODO - inform user
		}
	});
}

function isActiveSubscription(branch){
	return branch._subscription.state === 'active';
}

module.exports = function(agenda){
	agenda.define('charge_subscriptions', function(job, done){
		Customers.find({}, function (err, customers){

			if(err) {
				done(err);
				return;
			}

			async.each(customers, function (customer, cb1){

				// Branches.find({customerId: customer._id}).populate({path: '_subscription', match: { state: 'active' }}).exec(function (err, branches){
				Branches.find({customerId: customer._id})
				.populate('_subscription')
				.exec(function (err, branches){

					if(err) {
						//TODO - log error
						//TODO - create job
						return cb1();
					}

					//remove unactive subscriptions from array
					var activeBranches = branches.filter(isActiveSubscription);

					var totalAmount = Big(0);

					debug('customer %s has %s active branches: ', customer.name, activeBranches.length);

					//charge active subscriptions
					async.each(activeBranches, function (branch, cb2){

						var sub = branch._subscription;

						if(sub.trialPeriod !== true){

							totalAmount = totalAmount.plus(sub.nextBillingAmount);
							
						}
						
						if(sub.currentBillingCyrcle >= sub.billingCyrcles){

							// !!TODO: Send notification to the user that his subscription expired
							if(sub.neverExpires === false){

								pauseBranch({customerId: customer._id, oid: branch.oid}, 'expired');

							} else {
								// subscription continues to change
								var nextBillingDate = moment().add(sub.billingFrequency, sub.frequencyUnit);

								sub.nextBillingDate = nextBillingDate.valueOf();
								sub.billingCyrcles = nextBillingDate.diff(moment(), 'days');
								sub.nextBillingAmount = Big(sub.amount).div(sub.billingCyrcles).toString(); // set the next billing amount for the new circle

								// reset billing circle 
								sub.currentBillingCyrcle = 1;
								debug('new billing cyrcle: ', sub);
							}
						} else {
							sub.currentBillingCyrcle += 1;
						}

						sub.save(function(err, result){
							if(err){
								//TODO - log error
								//TODO - create job
								cb2();
							} else {
								debug('subscription %s updated for customer: %s', sub._id, result.customerId);
								cb2();
							}
						});

					}, function (err){
						if(err) return cb1(err);
						if(totalAmount.gt(0)) {
							setCustomerBalance(customer, totalAmount.valueOf(), function (err){
								if(err) {
									//TODO - log the error
									//TODO - create job
									cb1();
								} else {
									cb1();
									debug('customer %s charged at: %s for %s%s, new balance is: %s', customer.name, new Date(), totalAmount, customer.currency, customer.balance);
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
					done(err);
				} else {
					debug('All customers charged at: %s', new Date());
					done();
				}
			});
		});
	});
};

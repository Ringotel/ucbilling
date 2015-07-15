var Subscriptions = require('../models/subscriptions');
var Customers = require('../models/customers');
var moment = require('moment');
var config = require('../config/server');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var async = require('async');

mongoose.connect(config.bdb);

function setCustomerBalance(params){
	/* Find customer to access his balance */
	Customers.findOne({id: params.id}, function(err, customer){
		if(err){

			//TODO - handle erro
			new Error(err);
			return;
		}

		debug('customer name: %s, prev balance: %s', customer.name, customer.balance);

		var newBalance = parseFloat(customer.balance) - parseFloat(params.amount);

		// Once customer balance drops below 0 - send notification
		if(customer.balance >= 0 && newBalance < 0){
			// !!TODO: Send Notification if Balance is Under 0
			customer.pastDueDate = moment().unix();
		}

		// set new customer balance
		customer.balance = newBalance;

		customer.save(function(err, result){
			if(err){
				debug('customer save error', err);
				//TODO - handle erro
				new Error(err);
			} else {
				debug('customer name: %s, new balance: %s', customer.name, customer.balance);
			}
		});

	});
}

module.exports = function(agenda){
	agenda.define('charge_subscription', function(job, done){
		// var start = moment().hours(0).minutes(0).seconds(0).unix();
		// var end = moment().hours(23).minutes(59).seconds(59).unix();
		// var start = moment().unix();
		// var end = moment().add(2, 'minutes').unix(); //change here TODO: check the amount of days in the month. For ex. in february the nextBillingDay would be 28 of February, in any other month it would be 30th
		// debug('start: %s, end: %s', start, end);
		// Subscriptions.find({state: 'active', nextBillingDate: {"$gte": start, "$lte": end}}, function(err, subs){
		Subscriptions.find({state: 'active'}, function(err, subs){
			if(err) {
				done(err);
				return;
			}
			
			// subs.forEach(function(sub){
			async.each(subs, function (sub, cb){
				debug('subscription customer: %s, prev subscription balance', sub.customerId, sub.balance);
				
				if(sub.trialPeriod === false){

					//subtract subscription amount from customer's balance
					setCustomerBalance({id: sub.customerId, amount: sub.nextBillingAmount});

					//subtract subscription amount from subscription balance
					sub.balance -= sub.nextBillingAmount;

				}

				sub.currentBillingCyrcle += 1;
				
				if(sub.currentBillingCyrcle > sub.billingCyrcles){

					// !!TODO: Send notification to the user that his subscription expired
					if(sub.neverExpires === false){
						sub.state = 'expired';
					} else {
						// subscription continues to change
						var nextBillingDate = moment().add(sub.billingFrequency, sub.frequencyUnit);

						newSub.nextBillingDate = nextBillingDate.unix();
						newSub.billingCyrcles = nextBillingDate.diff(moment(), 'days');
						sub.nextBillingAmount = parseFloat(sub.amount) / (moment().diff(sub.nextBillingDate, 'days')); // set the next billing amount for the new circle

						// reset billing circle 
						sub.currentBillingCyrcle = 1;
					}
				}

				// debug('new subscription: %s', sub);

				sub.save(function(err, result){
					if(err){
						cb(err);
					} else {
						debug('subscription customer: %s, new subscription balance', result.customerId, result.balance);
						cb();
					}
				});
			}, function (err){
				if(err) {
					done(err);
				} else {
					debug('charged at: %s', new Date());
					done();
				}
			});
		});
	});
};
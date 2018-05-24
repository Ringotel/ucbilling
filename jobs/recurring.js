var config = require('../env/index');
var async = require('async');
var moment = require('moment');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var Subscriptions = require('../models/subscriptions');
var Invoices = require('../models/invoices');
var Dids = require('../models/dids');
var SubscriptionsService = require('../services/subscriptions');
var logger = require('../modules/logger').jobs;
var jobs = require('../jobs');

mongoose.connect(config.bdb, { useMongoClient: true });
mongoose.Promise = global.Promise;

module.exports = function(agenda) {
	agenda.define('recurring', { lockLifetime: 5000, concurrency: 1, priority: 'high' }, recurringJob);
};

function recurringJob(job, done){
	var today = moment().valueOf();
	var startPeriod = moment(today).startOf('day').valueOf();
	var endPeriod = moment(today).endOf('day').valueOf();

	// Subscriptions.find({
	// 	$and: [ 
	// 		{ $or: [ { state: "active" }, { status: "active" } ] }, 
	// 		{ $or: [ {nextBillingDate: { $gte: startPeriod, $lte: endPeriod }}, {nextBillingDate: { $lt: startPeriod }} ] }
	// 	]
	// })
	Subscriptions.find({ status: "active", nextBillingDate: { $lte: endPeriod } })
	.then(processSubscriptions)
	.then(() => {
		logger.info('All subscription updated');
		done();
	})
	.catch((err) => {
		logger.error('recurringJob error: %j', err);
		done(err);
	});
}

function processSubscriptions(subs){

	return new Promise((resolve, reject) => {

		logger.info('Total active subscriptions for period: %s', subs.length);

		async.each(subs, function (sub, cb){
			
			logger.info('Start processing subscription: %s', sub._id.toString());

			processSubscription(sub, function(err, newSub) {
				
				if(err)
					logger.error('processSubscription %s error: %j', sub._id.toString(), JSON.stringify(err));
				else
					logger.info('Subscription %s processed', sub._id.toString());

				cb();

			});

		}, function(err) {			
			if(err) return reject(err);
			resolve();
		});
	});
}

function processSubscription(sub, callback) {

	if(!sub.plan) return callback();

	if(sub.plan.trialPeriod) {
		// if subscription has trial period and it has been expired - deactivate subscription and branch
		if(sub.trialExpires && moment(sub.trialExpires).isSameOrBefore(moment(), 'day')) {
			logger.info('Customer '+sub.customer+'. Trial expired for subscription '+sub._id);
			// sub.state = 'expired';
			SubscriptionsService.cancel(sub, 'expired');
			// jobs.now('trial_expired', { lang: sub.customer.lang, name: sub.customer.name, email: customer.email, prefix: branch.prefix });
			
			callback(null, sub);

		} else {
			callback();
		}
			
	} else {
		sub.nextBillingDate = moment().add(sub.plan.billingPeriod, sub.plan.billingPeriodUnit).valueOf();
		sub.prevBillingDate = Date.now();

		if(parseFloat(sub.amount) <= 0) { // if subscription amount is less or equal 0
			return callback();
		}

		// generate invoice
		let invoice = new Invoices({
			customer: sub.customer,
			subscription: sub._id,
			currency: sub.plan.currency,
			items: {
				type: 'default',
				description: sub.description,
				amount: sub.amount
			}
		});
			
		invoice.save()
		.then(result => sub.save())
		.then(result => callback(null, result))
		.catch(err => callback(err));

	}

}
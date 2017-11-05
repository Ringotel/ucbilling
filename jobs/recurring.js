var config = require('../env/index');
var Subscriptions = require('../models/subscriptions');
var Invoices = require('../models/invoices');
var BranchesService = require('../services/branches');
var async = require('async');
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
	var today = moment().valueOf();
	var startPeriod = moment(today).startOf('day').valueOf();
	var endPeriod = moment(today).endOf('day').valueOf();

	Subscriptions.find({
		state: "active", 
		$or: [ {nextBillingDate: { $gte: startPeriod, $lte: endPeriod }}, {nextBillingDate: { $lt: startPeriod }} ]
	})
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
				
				if(err) {
					logger.error('processSubscription error: %j: sub: %j', JSON.stringify(err), JSON.stringify(newSub))
					return cb();
				}

				if(!newSub) return cb();

				newSub.save()
				.then(function(result) {
					logger.info('Subscription %s processed', result._id.toString());
				})
				.catch(err => {
					// TODO: retry or set a new agenda job
					logger.error('Subscription save error: %j: sub: %j', JSON.stringify(err), JSON.stringify(newSub))
					cb()
				});

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
		// if trial period expires - deactivate trial period
		logger.info('Customer '+sub.customer+'. Trial expired for subscription '+sub._id);
		sub.state = 'expired';
		disableBranch(sub.branch);
		// jobs.now('trial_expired', { lang: sub.customer.lang, name: sub.customer.name, email: customer.email, prefix: branch.prefix });
		
		return callback(null, sub);
	}

	sub.nextBillingDate = moment().add(sub.plan.billingPeriod, sub.plan.billingPeriodUnit).valueOf();
	sub.prevBillingDate = Date.now();

	// generate invoice
	let invoice = new Invoices({
		customer: sub.customer,
		subscription: sub._id,
		currency: sub.plan.currency,
		items: [{
			description: sub.description,
			amount: sub.amount
		}]
	});

	invoice.save()
	.then(result => callback(null, sub))
	.catch(err => callback(null, err));

}

function disableBranch(branch, callback){
	logger.info('Disabling branch: %j:', branch);

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
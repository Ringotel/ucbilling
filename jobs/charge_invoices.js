var config = require('../env/index');
var Subscriptions = require('../models/subscriptions');
var Invoices = require('../models/invoices');
var SubscriptionsService = require('../services/subscriptions');
var BranchesService = require('../services/branches');
var InvoicesService = require('../services/invoices');
var async = require('async');
var moment = require('moment');
var mongoose = require('mongoose');
var debug = require('debug')('jobs');
var logger = require('../modules/logger').jobs;
var jobs = require('../jobs');

mongoose.connect(config.bdb, { useMongoClient: true });
mongoose.Promise = global.Promise;

module.exports = function(agenda) {
	agenda.define('charge_invoices', { lockLifetime: 5000, concurrency: 1, priority: 'high' }, chargeInvoices);
};

function chargeInvoices(job, done){

	Invoices.find({ status: "unpaid"})
	.populate('customer')
	.then(processInvoices)
	.then(() => {
		logger.info('All invoices processed');
		done();
	})
	.catch((err) => {
		logger.error('charge_invoices job error: %j', err);
		done(err);
	});
}

function processInvoices(items){

	return new Promise((resolve, reject) => {

		logger.info('Total unpaid invoices: %s', items.length);

		async.each(items, function (item, cb){
			
			logger.info('Start processing invoice: %s', item._id.toString());

			processInvoice(item, function(err, result) {
				
				if(err) {
					logger.error('processInvoices error: %j: item: %j', JSON.stringify(err));
					return cb();
				}

				if(!result) return cb();

				result.save()
				.then(function(result) {
					logger.info('item %s processed', result._id.toString());
					cb();
				})
				.catch(err => {
					// TODO: retry or set a new agenda job
					logger.error('item save error: %j: sub: %j', JSON.stringify(err), JSON.stringify(result))
					cb();
				});

			});

		}, function(err) {			
			if(err) return reject(err);
			resolve();
		});
	});
}

function processInvoice(item, callback) {

	InvoicesService.pay(item)
	.then(result => {
		logger.info('processInvoice success: %j', item._id.toString());
		callback(null, result);
	})
	.catch(err => {
		
		// if invoice has not been paid
		
		logger.error('processInvoice error: %j: item: %j', err, item._id.toString());

		if(item.attemptCount >= item.maxAttempts) {
			item.status = 'past_due';
			cancelSubscription(item.subscription, function(err) {
				if(err) return callback(err);
				callback(null, item);
			});

		} else {
			item.attemptCount++;
			callback(null, item);

		}
		

	});

}

function cancelSubscription(sub, callback){
	logger.info('Disabling subscription: %j:', sub);

	async.waterfall([
		function(cb) {
			// get subscription object
			if(typeof sub === 'function') {
				cb(null, sub)
			} else {
				Subscriptions.findOne({ _id: sub })
				.then(result => {
					sub = result;
					cb(null, sub);
				})
				.catch(err => cb(new Error(err)));
			}

		},
		function(sub, cb) {
			sub.state = 'past_due';
			sub.pastDueSince = Date.now();
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
			logger.error('charge_invoices job error: cancel subscription error: %j: sub: %j', JSON.stringify(err), JSON.stringify(sub));
			callback(err);
		} else {
			logger.info('charge_invoices job: subscription canceled: %j', sub._id.toString());
			callback();
		}
	});
}
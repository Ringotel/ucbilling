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
	var today = moment().valueOf();
	var endPeriod = moment(today).endOf('day').valueOf();

	Invoices.find({ 
		status: "unpaid",
		nextAttempt: { $lte: endPeriod }
	})
	// .populate('customer')
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
					logger.error('Processing invoice error: %j: invoiceId: %s', err, item._id.toString());
				}

				logger.info('End processing invoice: %s - error: %s', JSON.stringify(result), JSON.stringify(err));

				if(!result) return cb();

				result.save()
				.then(result => {cb(null, result)})
				.catch(err => {cb(err)});

			});

		}, function(err) {			
			if(err) return reject(err);
			resolve();
		});
	});
}

function processInvoice(item, callback) {

	InvoicesService.pay(item)
	.then(function(result) {
		logger.error('processInvoice success: %s', JSON.stringify(result));
		callback(null, result);
	}, function(err) {
		// if invoice has not been paid
		
		logger.error('processInvoice error: %j - item: %', err, JSON.stringify(item));

		if(item.attemptCount >= item.maxAttempts) {
			SubscriptionsService.cancel(item.subscription, 'past_due', function(err) {
				if(err) return callback();
				item.status = 'past_due';
				callback(null, item);		
			});
		} else {
			item.attemptCount++;
			item.lastAttempt = moment().valueOf();
			item.nextAttempt = getNextAttemptDate(item.attemptCount);
			callback(null, item);
		}
		
	});

}

function getNextAttemptDate(attemptNum) {
	var date = moment();

	if(attemptNum === 1) {
		date.add(3, 'days');
	} else if(attemptNum === 2) {
		date.add(5, 'days');
	} else {
		date.add(7, 'days');
	}

	return date.valueOf();

}

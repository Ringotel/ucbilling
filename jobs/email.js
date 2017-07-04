var mailer = require('../modules/mailer');
var translations = require('../translations/mailer.json');
var debug = require('debug')('jobs');
var logger = require('../modules/logger').mailer;

module.exports = function(agenda) {
	
	agenda.define('subscription_expires', function(job, done) {
		var data = job.attrs.data;
		mailer.send({
			from: {
				name: "Ringotel Service Support",
				address: "service@ringotel.co"
			},
			to: data.email,
			subject: translations[data.lang].SUBSCRIPTION_EXPIRES.SUBJECT,
			body: 'subscription_expires',
			lang: data.lang,
			name: data.name,
			prefix: data.prefix,
			expDays: data.expDays
		}, function(err, result) {
			debug('subscription_expires job result: ', err, result);
			if(err) {
				// Handle error
				logger.error(err);
			}
			done();
		});
	});

	agenda.define('subscription_expired', function(job, done) {
		var data = job.attrs.data;
		mailer.send({
			from: {
				name: "Ringotel Service Support",
				address: "service@ringotel.co"
			},
			to: data.email,
			subject: translations[data.lang].SUBSCRIPTION_EXPIRED.SUBJECT,
			body: 'subscription_expired',
			lang: data.lang,
			name: data.name,
			prefix: data.prefix
		}, function(err, result) {
			debug('subscription_expired job result: ', err, result);
			if(err) {
				// Handle error
				logger.error(err);
			}
			done();
		});
	});

	agenda.define('trial_expired', function(job, done) {
		var data = job.attrs.data;
		mailer.send({
			from: {
				name: "Ringotel Service Support",
				address: "service@ringotel.co"
			},
			to: data.email,
			subject: translations[data.lang].TRIAL_EXPIRED.SUBJECT,
			body: 'trial_expired',
			lang: data.lang,
			name: data.name,
			prefix: data.prefix,
		}, function(err, result) {
			debug('trial_expired job result: ', err, result);
			if(err) {
				// Handle error
				logger.error(err);
			}
			done();
		});
	});

	agenda.define('past_due', function(job, done) {
		var data = job.attrs.data;
		mailer.send({
			from: {
				name: "Ringotel Service Support",
				address: "service@ringotel.co"
			},
			to: data.email,
			subject: translations[data.lang].PAST_DUE.SUBJECT,
			body: 'past_due',
			lang: data.lang,
			name: data.name,
			balance: parseFloat(data.balance).toFixed(2),
			currency: data.currency
		}, function(err, result) {
			debug('past_due job result: ', err, result);
			if(err) {
				// Handle error
				logger.error(err);
			}
			done();
		});
	});

};
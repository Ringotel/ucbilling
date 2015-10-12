// Setup agenda
// var config = require('./config/server');
var config = require('./env/index');
var Agenda = require("agenda");
var agenda = new Agenda({
	db: { address: config.agendadb}
	// processEvery: '30 seconds'
});
var logger = require('./modules/logger').jobs;
// subscriptionsJobs.charge_subscription(agenda);
// agenda.now('charge_subscription');
// agenda.every('one minute', 'charge_subscription');

agenda.on('start', function(job) {
  logger.info("Job %s starting", job.attrs.name);
});

agenda.on('complete', function(job) {
  logger.info("Job %s finished", job.attrs.name);
});

agenda.on('success:charge_subscriptions', function(job) {
  logger.info("Job %s finished Successfully", job.attrs.name);
});

agenda.on('fail:charge_subscriptions', function(err, job) {
  logger.error("Job %s failed with error: %s", job.attrs.name, err.message);
});

require('./jobs/subscriptions')(agenda);

agenda.every('10 minutes', 'charge_subscriptions', {time: new Date()});

agenda.start();

// console.log('Wait every 30 seconds...');
module.exports = agenda;
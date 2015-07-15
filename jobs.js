// Setup agenda
var config = require('./config/server');
var Agenda = require("Agenda");
var agenda = new Agenda({
	db: { address: config.agendadb}
	// processEvery: '30 seconds'
});
// subscriptionsJobs.charge_subscription(agenda);
// agenda.now('charge_subscription');
// agenda.every('one minute', 'charge_subscription');

agenda.on('start', function(job) {
  console.log("Job %s starting", job.attrs.name);
});

agenda.on('complete', function(job) {
  console.log("Job %s finished", job.attrs.name);
});

agenda.on('success:charge_subscription', function(job) {
  console.log("Finished Successfully");
});

agenda.on('fail:charge_subscription', function(err, job) {
  console.log("Job failed with error: %s", err.message);
});

require('./jobs/subscriptions')(agenda);

agenda.every('1 minute', 'charge_subscription', {time: new Date()});

agenda.start();

// console.log('Wait every 30 seconds...');
module.exports = agenda;
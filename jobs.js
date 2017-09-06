// Setup agenda
var os = require('os');
var logger = require('./modules/logger').jobs;
var config = require('./env/index');
var debug = require('debug')('jobs');
var Agenda = require("agenda");
var agenda = new Agenda({
	name: os.hostname() + '-' + process.pid,
	db: {
		address: config.agendadb,
		collection: 'agendaJobs',
		options: {
			uri_decode_auth: true
		}
	}
	// processEvery: '30 seconds'
}, function (err){
	if (err) {
		debug('agenda init error: ', err);
		throw err;
	}
	agenda.emit('ready');

});

// function repeatJob(repeat, job){
// 	agenda.every(repeat, job);
// }

function scheduleJob(job, schedule, repeat, type, data) {
	var chargeJob;
	chargeJob = agenda.create(job, data);
	if(schedule) chargeJob.schedule(schedule);
	if(repeat) chargeJob.repeatEvery(repeat);
	if(type) chargeJob.attrs.type = type;
	chargeJob.save();
}

agenda.on('ready', function() {
	var jobTypes = process.env.JOB_TYPES ? process.env.JOB_TYPES.split(',') : [];

	jobTypes.forEach(function(type) {
		require('./jobs/' + type)(agenda);
		if(type === 'recurring') scheduleJob(type, 'in 5 seconds', '1 hour', 'single', {time: new Date()});
		else if(type === 'charge_invoices') scheduleJob(type, 'in 25 seconds', '1 hour', 'single', {time: new Date()});
		// if(type === 'recurring') scheduleJob(type, 'in 1 minute', '6 hours', 'single', {time: new Date()});
	});

	if(jobTypes.length) agenda.start();
});

agenda.on('start', function(job) {
  logger.info("Job %s starting", job.attrs.name);
});

agenda.on('complete', function(job) {
  logger.info("Job %s finished", job.attrs.name);
});

agenda.on('success', function(job) {
  logger.info("Job %s finished Successfully", job.attrs.name);
});

agenda.on('fail', function(err, job) {
  logger.error("Job %s failed with error: %s", job.attrs.name, err.message);
});

module.exports = agenda;
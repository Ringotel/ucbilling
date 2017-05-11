var debug = require('debug')('billing');
var config = require('../env/index');
var gcloud = require('gcloud');
var dns = gcloud.dns({
	keyFilename: config.gcloud.keyfile,
	projectId: config.gcloud.projectId
});

var zone = dns.zone(config.gcloud.dnszone);
var record, ttl = 86400;

module.exports = {
	get: function(params, callback) {
		var query = {
			name: params.prefix+'.'+config.gcloud.domain+'.',
		};

		zone.getRecords(query, function(err, result){
			if(err) return callback(err);
			callback(null, result);
		});
	},

	create: function(params, callback) {
		record = zone.record('cname', {
			name: params.prefix+'.'+config.gcloud.domain+'.',
			ttl: ttl,
			data: params.domain+'.'
		});

		zone.addRecords(record, function(err, result) {
			if(err) return callback(err);
			callback(null, result);
		});
	},

	remove: function(params, callback) {
		record = zone.record('cname', {
			name: params.prefix+'.'+config.gcloud.domain+'.',
			ttl: ttl,
			data: params.domain+'.'
		});

		zone.deleteRecords(record, function(err, result, apiResponse) {
			if(err) return callback(err);
			callback(null, result);
		});
	}
};
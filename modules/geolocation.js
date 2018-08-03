var request = require('request');
var debug = require('debug');
var config = require('../env/index');
var apiUrl = 'http://api.ipstack.com/';

module.exports = { getLocation }

function getLocation(params, callback) {
	let url = apiUrl+params.ip+'?access_key='+config.ipstackApiKey;
	debug('getLocation url: ', url);
	request(url, function(err, response, body) {
		if(err) return callback(err);
		if(body.success === false) return callback({ code: body.error.code, name: body.error.type, message: body.error.info });
		callback(null, JSON.parse(body));
	});
}
var https = require('https');
var Servers = require('../models/servers');
var fs = require('fs');
var path = require('path');
var async = require('async');
var debug = require('debug')('billing');
var decrypt = require('../services/encrypt').decrypt;
var logger = require('../modules/logger').api;

require('ssl-root-cas/latest').inject();

var getServer = function(sid){
	return new Promise((resolve, reject) => {
		if(!sid) return reject({ name: 'ERR_MISSING_ARGS', message: "sid is undefined" });
		Servers.findOne({ _id: sid, state: '1' })
		.then(result => resolve(result))
		.catch(err => reject(new Error(err)));
	});

};

module.exports = {

	request: function(params, callback){
		debug('cti requestParams:', params);

		async.waterfall([

			function (cb){
				if(params.server) {
					cb(null, params.server);
				} else {
					getServer(params.sid)
					.then(function (server){
						if(!server) return cb({ name: 'ENOENT', message: "server not found" });
						cb(null, server);
					})
					.catch(err => cb(err));
				}
			},
			function (server, cb){
				let json = JSON.stringify(params.data);
				let url = server.url.split(':');
				let options = {
					hostname: url[0],
					port: url[1],
					method: 'POST',
					auth: server.login+':'+(decrypt(server.password)),
					ca: fs.readFileSync(path.join(__dirname, '../ssl/'+server.ca), 'utf8'),
					// rejectUnauthorized: false,
					headers: {
						'Content-Type': 'application/json;charset=UTF-8',
						'Content-Length': Buffer.byteLength(json, 'utf8')
					}
				};

				let req = https.request(options, function(res){
					let responseStr = '';

					res.setEncoding('utf8');
					res.on('data', function(data){
						responseStr += data;
					});
					res.on('end', function(){
						debug('cti responseStr:', responseStr);
						
						res.emit('close');

						if(!responseStr) return cb();
						if(!(typeof responseStr === 'object' || typeof responseStr === 'string')) return cb('UNEXPECTED_RESPONSE');
						
						let data = JSON.parse(responseStr);
						if(data.error){
							logger.error(data.error.message, { server: server.url });
							cb(data.error.message);
						} else {
							cb(null, data.result);
						}

					});
				});

				req.on('error', function(err){
					logger.error(err, { server: server.url });
					cb(err);
				});

				req.end(json);
			}

		], function (err, responseData){
			if(err) return callback(err);
			callback(null, responseData);
		});
	}
};
var https = require('https');
var Servers = require('../services/servers');
var fs = require('fs');
var path = require('path');
var async = require('async');
var debug = require('debug')('billing');
var decrypt = require('../services/encrypt').decrypt;
var logger = require('../modules/logger').api;

require('ssl-root-cas/latest')
  .inject();
  // .addFile(path.join(__dirname, '../ssl/sip-tv.net.int.crt'), 'utf8')
  // .addFile(path.join(__dirname, '../ssl/sip-tv.net.crt'), 'utf8');

var getServerOptions = function(sid, cb){

	if(sid){

		//TODO - change query parameter name to server "id"
		Servers.getOne({ _id: sid, state: '1' }, null, function (err, server){
			if(err) {
				return cb(err);
			}

			cb(null, server);

		});

	} else {
		cb('No identifier provided');
	}
};

module.exports = {

	request: function(params, callback){
		debug('cti requestParams:', params);

		async.waterfall([

			function (cb){
				if(params.server) {
					cb(null, params.server);
				} else {
					getServerOptions(params.sid, function (err, server){
						if(err) return cb(err);
						if(!server) return cb('NOT_FOUND');
						cb(null, server);
					});
				}
			},
			function (server, cb){
				var json = JSON.stringify(params.data);
				var url = server.url.split(':');
				var options = {
					hostname: url[0],
					port: url[1],
					method: 'POST',
					auth: server.login+':'+(decrypt(server.password)),
					ca: fs.readFileSync(path.join(__dirname, '../ssl/'+server.ca), 'utf8'),
					// rejectUnauthorized: false,
					// agent: new https.Agent({keepAlive: true}),
					headers: {
						'Content-Type': 'application/json;charset=UTF-8',
						'Content-Length': Buffer.byteLength(json, 'utf8')
					}
				};

				var req = https.request(options, function(res){
					res.setEncoding('utf8');

					var responseStr = '';

					res.on('data', function(data){
						responseStr += data;
					});

					res.on('end', function(){
						debug('cti responseStr:', responseStr);
						if(!responseStr) {
							cb();
						} else {
							if(!(typeof responseStr === 'object' || typeof responseStr === 'string')) return cb('UNEXPECTED_RESPONSE');
							
							var data = JSON.parse(responseStr);
							if(data.error){
								logger.error(data.error.message, { server: server.url });
								cb(data.error.message);
							} else {
								cb(null, data);
							}
						}
						res.emit('close');
					});
				});

				req.on('error', function(err){
					logger.error(err, { server: server.url });
					cb(err);
				});

				req.end(json);
			}

		], function (err, responseData){
			if(err) {
				return callback(err);
			}
			callback(null, responseData);
		});
	}
};
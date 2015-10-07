var https = require('https');
var Servers = require('./servers');
var fs = require('fs');
var path = require('path');
var async = require('async');
var debug = require('debug')('billing');

// require('ssl-root-cas/latest')
//   .inject()
//   .addFile(path.join(__dirname, '../ssl/sip-tv.net.int.crt'), 'utf8')
//   .addFile(path.join(__dirname, '../ssl/sip-tv.net.crt'), 'utf8');

var getServerOptions = function(sid, cb){

	if(sid){

		//TODO - change query parameter name to server "id"
		Servers.get({_id: sid}, function (err, server){
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
				getServerOptions(params.sid, function (err, server){
					if(err) return cb(err);
					if(!server) return cb('NOT_FOUND');
					cb(null, server);
				});
			},
			function (server, cb){
				var json = JSON.stringify(params.data);

				var url = server.url.split(':');

				var options = {
					hostname: url[0],
					port: url[1],
					method: 'POST',
					auth: server.login+':'+server.password,
					ca: fs.readFileSync(path.join(__dirname, '../ssl/'+server.ca), 'utf8'),
					rejectUnauthorized: false,
					// agent: new https.Agent({keepAlive: true}),
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': json.length
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
							var data = JSON.parse(responseStr);
							if(data.error){
								cb(data.error.message);
							} else {
								cb(null, data);
							}
						}
						res.emit('close');
					});
				});

				req.on('error', function(err){
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
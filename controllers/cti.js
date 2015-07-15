var https = require('https');
var Servers = require('./servers');

var getServerOptions = function(sid, cb){

	Servers.get({id: sid}, function(err, server){
		if(err) {
			cb(err);
		} else {

			var url = server.url.split(':');
			var options = {
				hostname: url[0],
				port: url[1],
				method: 'POST',
				auth: server.login+':'+server.password,
				ca: server.ca,
				rejectUnauthorized: true,
				agent: new https.Agent({keepAlive: true})
			};

			cb(null, options);
		}
	});

};

module.exports = {

	request: function(params, cb){

		getServerOptions(params.server, function(err, options){
			if(err){
				cb(err);
				return;
			}

			var json = JSON.stringify(params.data);
			options.headers = {
				'Content-Type': 'application/json',
				'Content-Length': json.length
			};
			var req = https.request(options, function(res){
				res.setEncoding('utf8');

				var responseStr = '';

				res.on('data', function(data){
					responseStr += data;
				});

				res.on('end', function(){
					console.log('responseStr:', responseStr);
					if(!responseStr) {
						cb(null);
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

			req.write(json);
			req.end();
		});
	}
};
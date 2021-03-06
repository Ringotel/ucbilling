var ServersService = require('../services/servers');

var methods = {
	
	getServers: function(req, res, next){
		var params = req.body;
		ServersService.get({ state: '1' }, '_id name countryCode', function (err, result){
			if(err) return next(new Error(err));
			res.json({
				success: true,
				result: result
			});
		});
	}

};

module.exports = methods;

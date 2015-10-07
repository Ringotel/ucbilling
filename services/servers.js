var Servers = require('../models/servers');

var methods = {
	get: function(params, select, callback){
		var query = Servers.find(params);
		if(select) query.select(select);
		query.exec(function (err, result){
			if(err) return callback(err);
			callback(null, result);
		});
	}
};

module.exports = methods;
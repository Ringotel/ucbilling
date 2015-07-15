var Servers = require('../models/servers');

module.exports = {
	
	create: function(){
		
	},

	update: function(){
		
	},

	get: function(id, cb){
		Servers.findOne({id: id}, function(err, server){
			if(err){
				cb(err);
			} else {
				cb(null, server);
			}
		});
	},

	deleteIt: function(){
		
	}

};
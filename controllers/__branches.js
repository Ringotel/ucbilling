var Branches = require('../models/branches');

module.exports = {
	
	all: function(){
		
	},

	create: function(params, cb){
		Branch = new Branches(params);
		Branch.save(function(err, branch){
			if(err){
				cb(err);
			} else {
				cb(null, branch);
			}
		});
	},

	update: function(){
		
	},

	get: function(oid, cb){
		Branches.findOne({oid: oid}, function(err, branch){
			if(err){
				cb(err);
			} else {
				cb(null, branch);
			}
		});
	},

	deleteIt: function(){
		
	}

};
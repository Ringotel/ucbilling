var Servers = require('../models/servers');
var extend = require('../lib/utils').extend;

var methods = {
	
	getAll: function(req, res, next){
		Servers.find({}, function(err, array){
			if(err){
				next(new Error(err));
			} else {
				res.json(array);
			}
		});
	},

	add: function(req, res, next){
		var params = req.body;
		var newServer = new Servers(params);

		//TODO - encrypt admin password!!!
		newServer.save(function (err, server){
			if(err) {
				next(new Error(err));
			} else {
				res.json({success: true, result: server});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		Servers.findOne({_id: req.params.id}, function (err, server){
			if(err){
				next(new Error(err));
			} else {
				extend(server, params);
				server.save(params, function (err, result){
					if(err) return next(err);
					res.json({
						success: true
					});
				});
			}
		});
	},

	getRequest: function(req, res, next){
		methods.get({_id: req.params.id}, function (err, result){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: result
				});
			}
		});
	},

	get: function(query, cb){
		Servers.findOne(query, function(err, server){
			if(err){
				cb(err);
			} else {
				cb(null, server);
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Servers.remove({_id: req.params.id}, function(err){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
			}
		});
	}

};

module.exports = methods;

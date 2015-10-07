var Addon = require('../models/addons');

var methods = {
	
	getAllRequest: function(req, res, next){
		methods.getAll(function(err, addons){
			if(err){
				next(new Error(err));
			} else {
				res.json(addons);
			}
		});
	},

	getAll: function(cb){
		Addon.find({}).lean().exec(function(err, array){
			if(err){
				cb(err);
			} else {
				cb(null, array);
			}
		});
	},

	add: function(req, res, next){
		var params = req.body;
		// params.created = Date.now();
		// params.id = params.created;

		var newAddon = new Addon(params);
		newAddon.save(function(err, addon){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, result: addon});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		console.log('update addon', params);
		Addon.update({_id: req.params.id}, params, function(err, data){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true
				});
			}
		});
	},

	get: function(req, res, next){
		Addon.findOne({_id: req.params.id}, function(err, addon){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: addon
				});
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Addon.remove({_id: req.params.id}, function(err){
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

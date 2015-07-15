var Addon = require('../models/addons');

module.exports = {
	
	getAll: function(cb){
		Addons.find({}, '-_id -__v').lean().exec(function(err, array){
			if(err){
				next(new Error(err));
			} else {
				res.json(array);
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
		Addon.update({id: req.params.id}, params, function(err, data){
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
		// var params = req.body.params;
		Addon.findOne({id: req.params.id}, function(err, addon){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					data: addon
				});
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Addon.remove({id: req.params.id}, function(err){
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
var Invoices = require('../models/invoices');

var methods = {
	
	getAll: function(req, res, next){
		Invoices
		.find()
		.limit(10)
		.sort({
			_id: -1
		})
		.exec(function(err, invoices){
			if(err){
				next(new Error(err));
			} else {
				res.json(invoices);
			}
		});
	},

	add: function(req, res, next){
		var params = req.body;
		// params.created = Date.now();
		// params.id = params.created;

		var newInvoice = new Invoices(params);
		newInvoice.save(function(err, invoice){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, result: invoice});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		console.log('update invoice', params);
		Invoices.update({_id: req.params.id}, params, function(err, data){
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
		Invoices.findOne({_id: req.params.id}, function(err, invoice){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					result: invoice
				});
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body.params;
		Invoices.remove({_id: req.params.id}, function(err){
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

var Customers = require('../models/customers');
var bcrypt = require('bcrypt');

var isValidPassword = function(password, hash, cb){
    bcrypt.compare(password, hash, function(err, isMatch){
        if(err) throw err;
        cb(isMatch);
    });
};

module.exports = {

	create: function(req, res, next){
		var params = req.body;
		console.log('customer params: ', params);
		// params.created = Date.now();
		var newCustomer = new Customers(params);
		newCustomer.save(function(err, customer){
			if(err){
				next(new Error(err));
			} else {
				res.json({success: true, id: customer.id});
			}
		});
	},

	update: function(req, res, next){
		var params = req.body;
		Customers.update({id: req.params.id}, params, function(err, data){
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
		var params = req.body;
		Customers.findOne({id: req.params.id}, function(err, customer){
			if(err){
				next(new Error(err));
			} else {
				res.json({
					success: true,
					customer: customer
				});
			}
		});
	},

	deleteIt: function(req, res, next){
		var params = req.body;
		Customers.remove({id: req.params.id}, function(err){
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
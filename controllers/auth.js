var Customers = require('../models/customers');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');

var isValidPassword = function(password, hash, cb){
    bcrypt.compare(password, hash, function(err, isMatch){
        if(err) throw err;
        cb(isMatch);
    });
};

module.exports = {

	loggedin: function(req, res, next){
		var customer = req.decoded;
		delete customer.password;
		res.json({
			success: true,
			customer: customer
		});
	},
	
	login: function(req, res, next){
		Customers.findOne({email: req.body.email}, function (err, customer){
			if(err){
				res.json({
					success: false,
					message: "Error occured: " + err
				});
			} else {
				if(customer){
					isValidPassword(req.body.password, customer.password, function (isMatch){
						if(!isMatch){
							res.json({
								success: false,
								message: 'Login failed. Invalid password.'
							});
						} else {
							var token = jwt.sign(customer, require('../config/server').secret, {
								expiresInMinutes: 30 //expires in 24 hours
							});

							// delete customer.password;
							delete customer.password;

							res.json({
								success: true,
								customer: customer,
								token: token
							});
						}
					});
				} else {
					res.json({
						success: false,
						message: "Login failed. Invalid email/password."
					});
				}
			}
		});
	},

	signup: function(req, res, next){
		Customers.findOne({email: req.body.email}, function(err, customer){
			if(err){
				res.json({
					success: false,
					message: "Error occured: " + err
				});
			} else {
				if(customer){
					res.json({
						success: false,
						message: "customer already exists!"
					});
				} else {
					var customerModel = new Customers();
					customerModel.email = req.body.email;
					customerModel.name = req.body.name;
					customerModel.password = req.body.password;
					customerModel.id = req.body.email;

					customerModel.save(function(err, customer){
						if (err){
							next(new Error('Error in Saving customer: '+err));
						} else {
							var token = jwt.sign(customer, require('../config/server').secret, {
								expiresInMinutes: 30 //expires in
							});

							delete customer.password;

							res.json({
								success: true,
								customer: customer,
								token: token
							});
						}
					});
				}
			}
		});
	}

};
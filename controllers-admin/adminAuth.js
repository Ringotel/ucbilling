var Admins = require('../models/admins');
var jwt = require('jsonwebtoken');
var bcrypt = require('../services/bcrypt');

module.exports = {

	loggedin: function(req, res, next){
		var user = req.decoded;
		delete user.password;
		res.json({
			success: true,
			result: user
		});
	},
	
	login: function(req, res, next){
		Admins.findOne({login: req.body.login}).lean().exec(function (err, user){
			if(err){
				next(new Error(err));
			} else {
				if(user && user.state === 'active'){
					bcrypt.compare(req.body.password, user.password, function (err, isMatch){
						if(err) throw err;
						if(!isMatch){
							res.json({
								success: false,
								message: 'Login failed. Invalid password.'
							});
						} else {
							var token = jwt.sign({
								email: user.email,
								name: user.name,
								role: user.role
							}, require('../env/index').secret, {
								expiresIn: require('../env/index').sessionTimeInSeconds
							});

							// delete user.password;
							delete user.password;

							res.json({
								success: true,
								result: user,
								token: token
							});
						}
					});
				} else {
					res.json({
						success: false,
						message: "Login failed. Invalid login/password."
					});
				}
			}
		});
	},

	signup: function(req, res, next){
		var params = req.body;
		Admins.findOne({login: params.login}).lean().exec(function (err, user){
			if(err){
				next(new Error(err));
			} else {
				if(user){
					res.json({
						success: false,
						message: "user already exists!"
					});
				} else {
					var userModel = new Admins();
					userModel.email = params.email;
					userModel.login = params.login;
					// userModel.name = req.body.name;
					userModel.password = params.password;
					// userModel.id = req.body.login;

					userModel.save(function(err, user){
						if (err){
							next(new Error(err));
						} else {
							var token = jwt.sign({
								email: params.email,
								name: params.name
							}, require('../env/index').secret, {
								expiresIn: require('../env/index').sessionTimeInSeconds
							});

							delete user.password;

							res.json({
								success: true,
								result: user,
								token: token
							});
						}
					});
				}
			}
		});
	}

};
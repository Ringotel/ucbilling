var Admins = require('../models/admins');
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
					isValidPassword(req.body.password, user.password, function (isMatch){
						if(!isMatch){
							res.json({
								success: false,
								message: 'Login failed. Invalid password.'
							});
						} else {
							var token = jwt.sign(user, require('../env/index').secret, {
								expiresInMinutes: 30 //expires
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
		Admins.findOne({login: req.body.login}).lean().exec(function (err, user){
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
					userModel.email = req.body.email;
					userModel.login = req.body.login;
					// userModel.name = req.body.name;
					userModel.password = req.body.password;
					// userModel.id = req.body.login;

					userModel.save(function(err, user){
						if (err){
							next(new Error(err));
						} else {
							var token = jwt.sign(user, require('../env/index').secret, {
								expiresInMinutes: 30 //expires in
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
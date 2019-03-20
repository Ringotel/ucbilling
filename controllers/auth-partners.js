var Partners = require('../models/partners');
var jwt = require('jsonwebtoken');
var bcrypt = require('../services/bcrypt');
var debug = require('debug')('billing');
var config = require('../env/index');
var apiLogger = require('../modules/logger').api;

module.exports = {
	loggedin: loggedin,
	login: login
};

function loggedin(req, res, next){
	var decoded = req.decoded;

	// if token was issued more than hour ago and session is still active - send a new token
	if((Math.floor(Date.now()/1000) - decoded.iat) > 3600 ){
		jwt.sign({
			// client_ip: req.ip,
			host: req.hostname,
			_id: decoded._id,
			role: decoded.role,
			state: decoded.state,
			currency: decoded.currency
		}, config.tokenSecret, { expiresIn: config.sessionTimeInSeconds }, function(token){
			console.log('loggedin token: ', token);
			res.json({
				success: true,
				partner: decoded,
				token: token
			});
		});
	} else {
		res.json({
			success: true,
			partner: decoded
		});
	}
}

function login(req, res, next){
	var params = req.body;

	if(!params.login || !params.password){
		res.status(403).json({
			success: false,
			error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
		});
		return;
	}
	Partners.findOne({login: params.login}, function (err, customer){
		debug('login: ', customer, params.password, customer.password);
		if(err){
			next(new Error(err));
		} else {
			if(customer){
				bcrypt.compare(params.password, customer.password, function (err, isMatch){
					if(err){
						next(new Error(err));
					} else if(!isMatch){
						res.status(403).json({
							success: false,
							error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
						});
					} else if(customer.state === 'suspended'){
						res.status(403).json({
							success: false,
							error: { name: "EINVAL", message: "INVALID_ACCOUNT" }
						});
					} else {

						var token = jwt.sign({
							// client_ip: req.ip,
							// host: req.hostname,
							_id: customer._id,
							role: customer.role,
							state: customer.state,
							currency: customer.currency
						}, config.tokenSecret, { expiresIn: config.sessionTimeInSeconds });

						res.json({
							success: true,
							token: token
						});

						customer.lastLogin = Date.now();
						customer.save(function(err, result) {
							if(err) apiLogger.error(err);
						});

					}
				});
			} else {
				res.status(403).json({
					success: false,
					error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
				});
			}
		}
	});
}
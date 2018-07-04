var Customers = require('../models/customers');
var Branches = require('../models/branches');
var TmpUser = require('../models/tmpusers');
var jwt = require('jsonwebtoken');
var bcrypt = require('../services/bcrypt');
var debug = require('debug')('billing');
var mailer = require('../modules/mailer');
var utils = require('../lib/utils');
var config = require('../env/index');
var apiLogger = require('../modules/logger').api;
var translations = require('../translations/mailer.json');

module.exports = {
	authorize: authorize,
	loggedin: loggedin,
	verify: verify,
	login: login,
	signup: signup,
	resetPassword: resetPassword,
	requestPasswordReset: requestPasswordReset
};

function sendSignupMail(params, cb) {
	// var link = params.protocol + '://' + config.apphost + '/api/verify-email/$' + params.token;
	var link = config.apiGateway + '/api/verify-email/$' + params.token;
	mailer.send({
		from: {
			name: "Ringotel Service Support",
			address: "service@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].CONFIRM_ACCOUNT.SUBJECT,
		body: 'confirm_account',
		lang: params.lang,
		name: params.name,
		link: link
	}, function(err, result){
		debug('mailer result: ', err, result);
		if(err) return cb(err);
		cb();
	});
	
}

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
				customer: decoded,
				token: token
			});
		});
	} else {
		res.json({
			success: true,
			customer: decoded
		});
	}
}

// Authorize user and return a token
function authorize(req, res, next) {
	var params = req.body;
	if(!params.login || !params.password){
		res.status(403).json({
			success: false,
			error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
		});
		return;
	}
	Customers.findOne({ login: params.login }, function (err, customer){
		if(err) return next(new Error(err));
		
		if(customer){
			bcrypt.compare(params.password, customer.password, function (err, isMatch){
				if(err) return next(new Error(err));
				
				if(!isMatch){
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
						host: req.hostname,
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
	});
}

function login(req, res, next){
	var params = req.body;

	if(!params.email || !params.password){
		res.status(403).json({
			success: false,
			error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
		});
		return;
	}
	Customers.findOne({email: req.body.email}, function (err, customer){
		if(err){
			next(new Error(err));
		} else {
			if(customer){
				bcrypt.compare(req.body.password, customer.password, function (err, isMatch){
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
							host: req.hostname,
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

function verify(req, res, next){
	var url = req.path;
	var token = req.path.substr(url.indexOf('$')+1);
	debug('token', token);

	TmpUser.findOne({token: token}, '-token -createdAt').lean().exec(function (err, user){

		if(err){
			next(new Error(err));
		} else {
			if(!user){
				res.redirect('/#/account-verification?verified=false');
			} else {
				//TODO - implement protocol and host compare
				var customer = new Customers(user);
				customer.save(function (err){
					if(err) {
						next(new Error(err));
					} else {
						TmpUser.findByIdAndRemove(user._id, function (err){
							if(err) {
								next(new Error(err));
							}
						});
						res.redirect('/#/account-verification?verified=true');
					}
				});
			}
		}
	});
}

function signup(req, res, next){
	var params = req.body;
	if(!params.email || !params.name || !params.password){
		res.json({
			success: false,
			error: { name: "ERR_MISSING_ARGS", message: "MISSING_FIELDS" }
		});
		return;
	}
	Customers.findOne({email: params.email}, function(err, customer){
		if(err){
			next(new Error(err));
		} else {
			if(customer){
				res.json({
					success: false,
					error: { name: "EINVAL", message: "CUSTOMER_EXISTS" }
				});
			} else {
				var newTmpUser;

				bcrypt.hash(params.password, function(err, hash){
					
					params.password = hash;
					params.currency = params.currency || 'EUR'; //TODO - determine currency base on the ip address or somehow

					debug('newCustomer: ', params);

					newTmpUser = new TmpUser(params);
					newTmpUser.save(function (err, tmpuser){
						debug('newTmpUser: ', err, tmpuser);
						if(err){
							if(err.code === 11000) {
								TmpUser.findOne({ email: params.email }, function(err, tmpuser) {
									tmpuser.protocol = req.protocol;
									sendSignupMail(tmpuser, function(err, result) {
										if(err) return next(new Error(err));
										res.json({success: true});
									});
								});
							} else {
								next(new Error(err));
							}
						} else {
							tmpuser.protocol = req.protocol;
							sendSignupMail(tmpuser, function(err, result) {
								if(err) return next(new Error(err));
								res.json({success: true});
							});
						}
					});
				});
			}
		}
	});
}

function resetPassword(req, res, next){
	var params = req.body;
	if(!params.password){
		res.status(403).json({
			success: false,
			error: { name: "ERR_MISSING_ARGS", message: "MISSING_FIELDS" }
		});
		return;
	}
	jwt.verify(decodeURIComponent(params.token), config.tokenSecret, function (err, decoded) {

		if (err) {
			next(new Error(err));
		} else {
			if(decoded.host === req.hostname && decoded.protocol === req.protocol){ //TODO - compare only with a certain hostname (e.g. sip-tv.net)
				// if everything is good, save customer and responce with OK page
				
				Customers.findOne({email: decoded.email}, function (err, customer){
					if(err){
						next(new Error(err));
					} else {
						if(customer){
							// bcrypt.hash(params.password, function (err, hash){
								customer.password = params.password;
								customer.save(function (err){
									if (err){
										next(new Error(err));
									} else {

										//TODO - do not repeat customer DB query
										Customers.findOne({email: decoded.email}).lean().exec(function (err, newCustomer){

											if(err){
												return next(new Error(err));
											}

											delete newCustomer.password;

											var token = jwt.sign({
												// client_ip: req.ip,
												host: req.hostname,
												_id: customer._id,
												role: customer.role,
												state: customer.state,
												currency: customer.currency
											}, config.tokenSecret, { expiresIn: config.sessionTimeInSeconds });

											res.json({
												success: true,
												customer: newCustomer,
												token: token
											});
										});
									}
								});
							// });
						} else {
							res.status(403).json({
								success: false,
								error: { name: "EINVAL", message: "INVALID_TOKEN" }
							});
						}
					}
				});
			} else {
				res.status(403).json({
					success: false,
					error: { name: "EINVAL", message: "INVALID_TOKEN" }
				});
			}
		}
	});
}

function requestPasswordReset(req, res, next){
	var params = req.body;
	if(!params.email){
		res.status(403).json({
			success: false,
			error: { name: "ERR_MISSING_ARGS", message: "MISSING_FIELDS" }
		});
		return;
	}
	Customers.findOne({email: params.email}, function (err, customer){
		if(err){
			next(new Error(err));
		} else {
			if(customer){
				var opts = {};
				opts.email = customer.email;
				opts.host = req.hostname;
				opts.protocol = req.protocol;

				var ott = jwt.sign(opts, config.tokenSecret),
					link = opts.protocol+"://"+config.apphost+"/#/reset-password?ott="+encodeURIComponent(ott);
					mailer.send({
						from: {
							name: "Ringotel Service Support",
							address: "service@ringotel.co"
						},
						to: customer.email,
						subject: translations[customer.lang].RESET_PASSWORD.SUBJECT,
						body: 'reset_password',
						lang: customer.lang,
						link: link
					}, function (err, result){
						debug('mailer result: ', err, result);
						if(err) return next(new Error(err));
						res.json({
							success: true,
							result: result
						});
					});
					// mailer.sendMail('resetPassword', { lang: customer.lang, email: opts.email, link: link }, function (err, result){
					// 	debug('mailer result: ', err, result);
					// 	if(err) return next(new Error(err));
					// 	res.json({
					// 		success: true,
					// 		result: result
					// 	});
					// });
			} else {
				res.status(403).json({
					success: false,
					error: { name: "EINVAL", message: "USER_NOT_FOUND" }
				});
			}
		}
	});
}
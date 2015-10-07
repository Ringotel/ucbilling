var Customers = require('../models/customers');
var TmpUser = require('../models/tmpusers');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
var bcryptCtrl = require('./bcrypt');
var debug = require('debug')('billing');
var mailer = require('../modules/mailer');
var utils = require('../lib/utils');

var isValidPassword = function(password, hash, cb){
    bcrypt.compare(password, hash, function(err, isMatch){
        if(err) cb(err);
        else cb(null, isMatch);
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

	verify: function(req, res, next){

		var url = req.path;
		var token = req.path.substr(url.indexOf('$')+1);
		debug('token', token);

		TmpUser.findOne({token: token}, '-token -createdAt').lean().exec(function (err, user){

			if(err){
				next(new Error(err));
			} else {
				if(!user){
					res.redirect('/#/account-verification?verified=false');
					// res.json({
					// 	success: false,
					// 	message: 'Invalid url token'
					// });
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

	},

	login: function(req, res, next){
		var params = req.body;
		if(!params.email){
			res.status(400).json({
				success: false,
				message: "MISSING_FIELDS"
			});
			return;
		}
		Customers.findOne({email: req.body.email}).lean().exec(function (err, customer){
			if(err){
				next(new Error(err));
			} else {
				if(customer){
					isValidPassword(req.body.password, customer.password, function (err, isMatch){
						if(err){
							next(new Error(err));
						} else if(!isMatch){
							res.status(400).json({
								success: false,
								message: 'INVALID_LOGIN_PASSWORD'
								// message: 'Login failed. Invalid password.'
							});
						} else if(customer.state === 'suspended'){
							res.status(400).json({
								success: false,
								message: 'INVALID_ACCOUNT'
								// message: 'Login failed. Invalid account.'
							});
						} else {

							delete customer.password;

							var token = jwt.sign({
								_id: customer._id,
								email: customer.email,
								name: customer.name,
								role: customer.role,
								state: customer.state,
								currency: customer.currency
							}, require('../env/index').secret, { expiresInSeconds: require('../env/index').sessionTimeInSeconds });

							res.json({
								success: true,
								customer: customer,
								token: token
							});
						}
					});
				} else {
					res.status(400).json({
						success: false,
						message: "INVALID_LOGIN_PASSWORD"
						// message: "Login failed. Invalid email/password."
					});
				}
			}
		});
	},

	signup: function(req, res, next){
		var params = req.body;
		if(!params.email || !params.name || !params.password){
			res.status(400).json({
				success: false,
				message: "MISSING_FIELDS"
			});
			return;
		}
		Customers.findOne({email: params.email}, function(err, customer){
			if(err){
				next(new Error(err));
			} else {
				if(customer){
					res.status(400).json({
						success: false,
						message: "CUSTOMER_EXISTS"
					});
				} else {
					var mailerOpts, newTmpUser;

					bcryptCtrl(params.password, function(err, hash){
						
						params.password = hash;
						params.currency = 'UAH'; //TODO - determine currency base on the ip address or somehow

						debug('newCustomer: ', params);

						newTmpUser = new TmpUser(params);
						newTmpUser.save(function (err, tmpuser){
							//TODO - handle unique token error (11000)
							if(err){
								next(new Error(err));
							} else {
								mailerOpts = {
									from: {
										name: "Service Support",
										address: "noreply@smile-soft.com"
									},
									to: params.email,
									subject: "Confirm your email",
									html: "Hello "+params.name+", <br> We super glad you've created account on sip-tv.org! If that wasn't you, please do nothing. In other case, please verify your email via this link: <br>"+(req.protocol + '://' + req.hostname + ':3002/api/verify-email/$' + tmpuser.token)
								};
								debug('mailerOpts: ', mailerOpts);
								mailer.sendMail(mailerOpts, function(err, result){
									debug('mailer result: ', err, result);
									if(err){
										next(new Error(err));
									} else {
										res.json({
											success: true
										});
									}
								});
							}
						});
					});
				}
			}
		});
	},

	resetPassword: function(req, res, next){
		var params = req.body;
		if(!params.password){
			res.status(400).json({
				success: false,
				message: "MISSING_FIELDS"
				// message: "Please fill in all required fields"
			});
			return;
		}
		jwt.verify(decodeURIComponent(params.token), require('../env/index').secret, function (err, decoded) {

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
								// bcryptCtrl(params.password, function (err, hash){
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
													_id: newCustomer._id,
													email: newCustomer.email,
													name: newCustomer.name,
													role: newCustomer.role,
													state: newCustomer.state,
													currency: newCustomer.currency
												}, require('../env/index').secret, {
													expiresInSeconds: require('../env/index').sessionTimeInSeconds
												});

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
								res.status(400).json({
									success: false,
									message: "INVALID_TOKEN"
									// message: "Failed to authenticate token."
								});
							}
						}
					});
				} else {
					res.status(400).json({
						success: false,
						message: 'INVALID_TOKEN'
						// message: 'Failed to authenticate token from another domain.'
					});
				}
			}
		});
	},

	requestPasswordReset: function(req, res, next){
		var params = req.body;
		if(!params.email){
			res.status(400).json({
				success: false,
				message: "MISSING_FIELDS"
				// message: "Please fill in all required fields"
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

					var ott = jwt.sign(opts, require('../env/index').secret),
						link = opts.protocol+"://"+opts.host+":3002"+"/#/reset-password?ott="+encodeURIComponent(ott),
						mailerOpts = {
							from: {
								name: "Service Support",
								address: "noreply@smile-soft.com"
							},
							to: opts.email,
							subject: "Request to reset your Sip-tv account password",
							html: "Hello, <br> We've recieved a request to reset Sip-tv account password. If that was you, please follow this link: <br>"+link+
								"<br> If you didn't make this request, please do nothing."
						};

						debug('mailerOpts: ', mailerOpts);
						mailer.sendMail(mailerOpts, function(err, result){
							debug('mailer result: ', err, result);
							if(err){
								next(new Error(err));
							} else {
								res.json({
									success: true
								});
							}
						});
				} else {
					res.status(400).json({
						success: false,
						message: "USER_NOT_FOUND"
						// message: "We didn't find user with this email: "+params.email
					});
				}
			}
		});
	}

};
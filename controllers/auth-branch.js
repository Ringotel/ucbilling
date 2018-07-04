var jwt = require('jsonwebtoken');
var debug = require('debug')('billing');
var shortid = require('shortid');
var async = require('async');
var request = require('request');
var Customers = require('../models/customers');
var Branches = require('../models/branches');
// var TmpUser = require('../models/tmpusers');
var bcrypt = require('../services/bcrypt');
var SubscriptionsService = require('../services/subscriptions');
var BranchesService = require('../services/branches');
var utils = require('../lib/utils');
var mailer = require('../modules/mailer');
var apiLogger = require('../modules/logger').api;
var translations = require('../translations/mailer.json');
var config = require('../env/index');
var Analytics = require('analytics-node');
var analytics = new Analytics(config.segmentKey);
var recaptchaUrl = 'https://www.google.com/recaptcha/api/siteverify';
var recaptchaSecret = '6LcWGloUAAAAAKtgw6tqhFbo-otzEt3kcmJIuJj7';

module.exports = {
	signup: signup,
	verify: verify,
	createBranch: createBranch,
	authorize: authorize,
	requestResetPassword: requestResetPassword,
	sendAppsLinks: sendAppsLinks
};

function signup(req, res, next){
	var params = req.body;
	debug('auth-branch signup params: ', params);

	async.waterfall([
		function(cb) {
			// check for required parameters
			// if(!params.company || !params.email || !params.domain || !params.password) 
			if(!params.company || !params.email || !params.name) 
				return cb({ name: "ERR_MISSING_ARGS", message: "MISSING_DATA" });
			
			if(!params.recaptchaToken) {
				return cb({ name: "NOT_FOUND", message: "NOT_FOUND" });
			}

			// params.domain = params.domain.toLowerCase();
			// params.domain = params.domain.replace(/\s/gi, "");

			cb();

		}, function(cb) {
			// verify recaptcha
			request.post({ url: recaptchaUrl, form: { secret: recaptchaSecret, response: params.recaptchaToken } }, function(err, response, body) {
				debug('recaptcha response body: ', JSON.parse(body));

				if(body && JSON.parse(body).success) {
					cb();
				} else {
					cb({ name: "NOT_FOUND", message: "NOT_FOUND" });
				}
			});

		}, function(cb) {
			// check if customer or email domain already exists
			
			var emailDomain = params.email.substr(params.email.indexOf('@')+1);

			Customers.count({ activated: true, $or: [{email: params.email}, {emailDomain: emailDomain}]}, function(err, result){
				if(err) return cb(new Error(err));
				if(result) return cb({ name: "EINVAL", message: "CUSTOMER_EXISTS" });
				cb();
			});

		}, function(cb) {
		// 	// check for valid and available domain/prefix
		// 	BranchesService.isPrefixValid(params.domain, function(err, result) {
		// 		if(err) return cb(new Error(err));
		// 		if(!result) return cb({ name: "EINVAL", message: "INVALID_BRANCH_PREFIX" });
		// 		cb();
		// 	});

		// }, function(cb) {
			// check for valid and available branch name
			BranchesService.isNameValid(params.company, function(err, result) {
				if(err) return cb(new Error(err));
				if(!result) return cb({ name: "EINVAL", message: "INVALID_BRANCH_NAME" });
				cb();
			});

		}, function(cb) {
			// create and save temporary user

			params.lang = params.lang || 'en';
			params.currency = params.currency || 'EUR'; //TODO - determine currency base on the ip address or somehow
			params.token = shortid.generate();
			// params.domain = params.domain.toLowerCase();

			debug('new branch customer: ', params);

			let newCustomer = new Customers(params);
			newCustomer.save(function (err, customer){
				debug('newCustomer: ', err, customer);
				if(err){
					if(err.code === 11000) {
						Customers.findOne({ email: params.email }, function(err, customer) {
							// customer.protocol = req.protocol;
							sendConfirmationCode(customer, function(err, result) {
								if(err) return cb(new Error(err));
								cb(null, customer);
							});
						});
					} else {
						cb(new Error(err));
					}
				} else {
					// customer.protocol = req.protocol;
					sendConfirmationCode(customer, function(err, result) {
						if(err) return cb(new Error(err));
						cb(null, customer)
					});
				}
			});

		}

	], function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			if(err.name === 'NOT_FOUND') return res.status(404).end();
			return res.json({ success: false, error: err });
		}

		analytics.identify({
		  userId: result._id.toString(),
		  traits: {
		    name: params.name,
		    email: params.email,
		    company: params.company
		  }
		});

		analytics.track({
		  userId: result._id.toString(),
		  event: 'Sign Up Request'
		});

		res.json({success: true});
	});
	
}

function sendConfirmationCode(params, cb) {
	mailer.send({
		from: {
			name: "Ringotel Service Support",
			address: "service@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].CONFIRMATION_CODE.SUBJECT,
		body: 'confirmation_code',
		lang: params.lang,
		name: params.name,
		token: params.token
	}, function(err, result){
		debug('sendConfirmationCode result: ', err, result);
		if(err) return cb(err);
		cb();
	});
}

// verify confirmation code 
// than create customer and subscription
function verify(req, res, next){
	var params = req.body;

	debug('verify', params);

	if(!params.token) {
		res.status(403).json({
			success: false,
			error: { name: "ERR_MISSING_ARGS", message: "MISSING_TOKEN" }
		});
		return;
	}

	if(!params.recaptchaToken) {
		return res.status(404).end();
	}

	params.token = decodeURIComponent(params.token);

	debug('verify token', params.token, params.recaptchaToken);

	async.waterfall([
		function(cb) {
			// verify recaptcha
			request.post({ url: recaptchaUrl, form: { secret: recaptchaSecret, response: params.recaptchaToken } }, function(err, response, body) {
				debug('verify recaptcha response body: ', JSON.parse(body));

				if(body && JSON.parse(body).success) {
					cb();
				} else {
					cb({ name: "NOT_FOUND", message: "NOT_FOUND" });
				}
			});

		}, function(cb) {
			// find and remove tmp user
			Customers.findOne({token: params.token}, '-token -createdAt')
			.lean()
			.exec()
			.then(response => {
				if(!response) return cb({ name: "EINVAL", message: "INVALID_CODE" });
				cb(null, response);
			})
			.catch(err => cb(new Error(err)));
		}
	], function(err, result) {
		debug('verify result: ', err, result);
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		analytics.track({
		  userId: result._id.toString(),
		  event: 'Sign Up Email Verified'
		});

		res.json({ success: true });
	});
}

// verify confirmation code 
// than create customer and subscription
function createBranch(req, res, next){
	var params = req.body;
	// var tmpuser = {};
	var customer = {};

	debug('verify', params);

	if(!params.token) {
		res.status(403).json({
			success: false,
			error: { name: "ERR_MISSING_ARGS", message: "MISSING_TOKEN" }
		});
		return;
	}

	if(!params.recaptchaToken) {
		return res.status(404).end();
	}

	params.token = decodeURIComponent(params.token);
	params.domain = params.domain.toLowerCase();
	params.domain = params.domain.replace(/\s/gi, "");

	debug('createBranch token', params.token, params.recaptchaToken);

	async.waterfall([
		function(cb) {
			// verify recaptcha
			request.post({ url: recaptchaUrl, form: { secret: recaptchaSecret, response: params.recaptchaToken } }, function(err, response, body) {
				debug('verify recaptcha response body: ', JSON.parse(body));

				if(body && JSON.parse(body).success) {
					cb();
				} else {
					cb({ name: "NOT_FOUND", message: "NOT_FOUND" });
				}
			});

		}, function(cb) {
			// find and remove tmp user
			Customers.findOne({token: params.token}, '-token -createdAt')
			// .lean()
			// .exec()
			.then(response => {
				if(!response) return cb({ name: "EINVAL", message: "INVALID_CODE" });
				customer = response;
				cb();
			})
			.catch(err => cb(new Error(err)));

		}, function(cb) {
			// check for valid and available domain/prefix
			BranchesService.isPrefixValid(params.domain, function(err, result) {
				if(err) return cb(new Error(err));
				if(!result) return cb({ name: "EINVAL", message: "INVALID_BRANCH_PREFIX" });
				cb();
			});
		}, function(cb) {
			// create customer
			// customer = new Customers(tmpuser);
			// create subscription
			SubscriptionsService.create({
				customerId: customer._id,
				// sid: '5a930d5a58a8035b8908d1b9', // DE1 server
				sid: customer.server || '591d464a12254108560fb2f9', // IE1 server
				// sid: '59159374ef93e34d7f23be35', // UA1 server
				subscription: {
					planId: 'free',
					description: 'Subscription to "Free" plan'
				},
				branch: {
					name: customer.company,
					lang: customer.lang,
					prefix: params.domain,
					admin: customer.name,
					adminemail: customer.email,
					adminname: params.login || params.domain,
					adminpass: params.password
				}
			}, function(err, result) {
				if(err) {
					cb(new Error(err));
				} else {
					cb(null, result);
				}
			});
		}, function(sub, cb) {
			customer.role = 'branchAdmin';
			customer.activated = true;
			customer.password = params.password;

			customer.save()
			.then(result => cb(null, result))
			.catch(err => cb(new Error(err)));
		}

	], function(err, result) {
		debug('createBranch result: ', err, result);
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true });

		sendWelcomeMessage({
			email: customer.email,
			lang: customer.lang,
			name: customer.name,
			domain: params.domain
		}, function(err, result) {
			if(err) apiLogger.error('sendWelcomeMessage error: %j', err);
			else apiLogger.info('sendWelcomeMessage success');
		});

		analytics.track({
		  userId: customer._id.toString(),
		  event: 'Sign Up Success'
		});

		mailer.selfNotify({
			subject: translations['en'].TEAM_NOTIFY_NEW_SIGNUP.SUBJECT,
			body: 'team_notify_new_signup',
			customer: customer
		});
	});
}

function sendWelcomeMessage(params, cb) {
	mailer.send({
		from: {
			name: "Ringotel Team",
			address: "team@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].WELCOME.SUBJECT,
		body: 'welcome',
		lang: params.lang,
		name: params.name,
		prefix: params.domain
	}, function(err, result){
		debug('sendWelcomeMessage result: ', err, result);
		if(err) return cb(err);
		cb();
	});
}

// Authorize user and return a token
function authorize(req, res, next) {
	var params = req.body;
	// var origin_ip = req.get('X-Forwarded-For');

	if(!params.prefix || !params.login || !params.password){
		res.status(403).json({
			success: false,
			error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
		});
		return;
	}

	Branches.findOne({ prefix: params.prefix }, function (err, result){
		if(err) return next(new Error(err));
		
		if(!result){
			res.status(403).json({
				success: false,
				error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
			});
			return;
		}
		
		request(('https://'+result.prefix+'.'+config.domain+'/'), {
			auth: {
				user: params.login,
				pass: params.password
			}
		}, function(err, response, body) {
			debug('authorize request: ', err, response.statusCode, response.statusMessage);

			if(response.statusCode === 200) {
				var token = jwt.sign({
					// host: req.hostname,
					customerId: result.customer,
					branchId: result._id,
					role: 'branchAdmin'
					// state: result.state
				}, config.tokenSecret, { expiresIn: config.sessionTimeInSeconds });

				res.json({
					success: true,
					token: token
				});

				analytics.track({
				  userId: result.customer.toString(),
				  event: 'Log In'
				});

				result.lastLogin = Date.now();
				result.save(function(err, result) {
					if(err) apiLogger.error(err);
				});

			} else {
				res.status(403).json({
					success: false,
					error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
				});
				return;
			}
				
		});

		// bcrypt.compare(params.password, result.adminpass, function (err, isMatch){
		// 	if(err) return next(new Error(err));
			
		// 	if(!isMatch){
		// 		res.status(403).json({
		// 			success: false,
		// 			error: { name: "EINVAL", message: "INVALID_LOGIN_PASSWORD" }
		// 		});
		// 		return;
		// 	} 

		// 	// else if(result.state === 'suspended'){
		// 	// 	res.status(403).json({
		// 	// 		success: false,
		// 	// 		message: 'INVALID_ACCOUNT'
		// 	// 	});
		// 	// } else {


		// 		var token = jwt.sign({
		// 			host: req.hostname,
		// 			customerId: result.customer,
		// 			branchId: result._id,
		// 			role: 'branchAdmin'
		// 			// state: result.state
		// 		}, config.tokenSecret, { expiresIn: config.sessionTimeInSeconds });

		// 		res.json({
		// 			success: true,
		// 			token: token
		// 		});

		// 		result.lastLogin = Date.now();
		// 		result.save(function(err, result) {
		// 			if(err) apiLogger.error(err);
		// 		});
		// 	// }
		// });
		
	});
}

// Reset user's password
function requestResetPassword(req, res, next) {
	var params = req.body;
	if(!params.prefix) {
		res.status(400).json({
			success: false,
			error: { name: 'ERR_MISSING_ARGS', message: 'Missing data' }
		});
		return;
	}

	Branches.findOne({ prefix: params.prefix }, function (err, result){
		if(err) return next(new Error(err));
		
		if(!result){
			res.status(404).json({
				success: false,
				error: { name: "ENOENT", message: "Not found" }
			});
			return;
		}

		var token = jwt.sign({
			// host: req.hostname,
			customerId: result.customer,
			branchId: result._id,
			role: 'branchAdmin'
			// state: result.state
		}, config.tokenSecret, { expiresIn: 3600 });

		var link = "https://"+result.prefix+"."+config.domain+"/public/reset-password.html?ott="+encodeURIComponent(token);

		debug('requestResetPassword link: ', link);

		sendResetPasswordLink({
			email: result.adminemail,
			lang: result.lang || 'en',
			link: link
		}, function(err, result) {
			if(err) return next(new Error(err));
			res.json({ success: true });
		});

		analytics.track({
		  userId: result.customer.toString(),
		  event: 'Password Reset Request'
		});

		// Customers.findById({ _id: result.customer }, function(err, customer) {

		// 	if(!customer){
		// 		res.status(404).json({
		// 			success: false,
		// 			error: { name: "ENOENT", message: "Not found" }
		// 		});
		// 		return;
		// 	}
		// });

	});


}

function sendResetPasswordLink(params, cb) {
	mailer.send({
		from: {
			name: "Ringotel Service Support",
			address: "service@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].RESET_PASSWORD.SUBJECT,
		body: 'reset_password',
		lang: params.lang,
		link: params.link
	}, function(err, result){
		if(err) {
			return cb(err);
		}
		
		debug('sendResetPasswordLink result: ', result);
		cb();
	});
}

function sendAppsLinks(req, res, next) {
	var params = req.body;
	mailer.send({
		from: {
			name: "Ringotel Service Support",
			address: "service@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].APPS_LINKS.SUBJECT,
		body: 'apps_links',
		lang: params.lang
	}, function(err, result){
		debug('sendAppsLinks result: ', result);
		if(err) return next(new Error(err));
		res.json({ success: true });
		
	});
}
var jwt = require('jsonwebtoken');
var debug = require('debug')('billing');
var shortid = require('shortid');
var async = require('async');
var Customers = require('../models/customers');
var Branches = require('../models/branches');
var TmpUser = require('../models/tmpusers');
var bcrypt = require('../services/bcrypt');
var SubscriptionsService = require('../services/subscriptions');
var utils = require('../lib/utils');
var config = require('../env/index');
var mailer = require('../modules/mailer');
var apiLogger = require('../modules/logger').api;
var translations = require('../translations/mailer.json');

module.exports = {
	verify: verify,
	signup: signup,
	authorize: authorize
};

function signup(req, res, next){
	var params = req.body;
	if(!params.email || !params.name || !params.password){
		res.json({
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
				res.json({
					success: false,
					message: "CUSTOMER_EXISTS"
				});
			} else {

				params.lang = params.lang || 'en';
				params.currency = params.currency || 'EUR'; //TODO - determine currency base on the ip address or somehow
				params.token = shortid.generate();

				debug('new branch customer: ', params);

				let newTmpUser = new TmpUser(params);
				newTmpUser.save(function (err, tmpuser){
					debug('newTmpUser: ', err, tmpuser);
					if(err){
						if(err.code === 11000) {
							TmpUser.findOne({ email: params.email }, function(err, tmpuser) {
								// tmpuser.protocol = req.protocol;
								sendConfirmationCode(tmpuser, function(err, result) {
									if(err) return next(new Error(err));
									res.json({success: true});
								});
							});
						} else {
							next(new Error(err));
						}
					} else {
						// tmpuser.protocol = req.protocol;
						sendConfirmationCode(tmpuser, function(err, result) {
							if(err) return next(new Error(err));
							res.json({success: true});
						});
					}
				});
			}
		}
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
	var tmpuser = {};
	var customer = {};

	debug('verify', params);

	if(!params.token) {
		res.status(403).json({
			success: false,
			message: "MISSING_TOKEN"
		});
		return;
	}

	params.token = decodeURIComponent(params.token);

	debug('verify token', params.token);

	async.waterfall([
		function(cb) {
			TmpUser.findOneAndRemove({token: params.token}, '-token -createdAt')
			.lean()
			.exec()
			.then(response => {
				if(!response) return cb({ name: "EINVAL", message: "invalid code" });
				tmpuser = response
				cb(null, tmpuser);
			})
			.catch(err => cb(new Error(err)));
		},
		function(tmpuser, cb) {
			customer = new Customers(tmpuser);
			customer.role = 'branchAdmin';
			customer.save()
			.then(result => cb())
			.catch(err => cb(new Error(err)));
		},
		function(cb) {
			SubscriptionsService.create({
				customerId: customer._id,
				sid: '591d464a12254108560fb2f9',
				subscription: {
					planId: 'trial',
					description: 'Subscription to trial plan. Company: '+tmpuser.company+'.'
				},
				branch: {
					name: tmpuser.company,
					prefix: tmpuser.domain,
					admin: tmpuser.name,
					email: tmpuser.email,
					adminname: tmpuser.domain,
					adminpass: tmpuser.password
				}
			}, function(err, result) {
				if(err) return cb(new Error(err));
				cb(null, result);
			});
		}

	], function(err, result) {
		debug('verify result: ', err, result);
		if(err) return next(new Error(err));
		res.json({ success: true });
	});
}

// Authorize user and return a token
function authorize(req, res, next) {
	var params = req.body;
	if(!params.login || !params.password){
		res.status(403).json({
			success: false,
			message: "INVALID_LOGIN_PASSWORD"
		});
		return;
	}
	Branches.findOne({ adminname: params.login }, function (err, result){
		if(err) return next(new Error(err));
		
		if(!result){
			res.status(403).json({
				success: false,
				message: "INVALID_LOGIN_PASSWORD"
			});
			return;
		}
		
		bcrypt.compare(params.password, result.adminpass, function (err, isMatch){
			if(err) return next(new Error(err));
			
			if(!isMatch){
				res.status(403).json({
					success: false,
					message: 'INVALID_LOGIN_PASSWORD'
				});
				return;
			} 

			// else if(result.state === 'suspended'){
			// 	res.status(403).json({
			// 		success: false,
			// 		message: 'INVALID_ACCOUNT'
			// 	});
			// } else {


				var token = jwt.sign({
					host: req.hostname,
					customerId: result.customer,
					branchId: result._id,
					role: 'branchAdmin'
					// state: result.state
				}, config.tokenSecret, { expiresIn: config.sessionTimeInSeconds });

				res.json({
					success: true,
					token: token
				});

				result.lastLogin = Date.now();
				result.save(function(err, result) {
					if(err) apiLogger.error(err);
				});
			// }
		});
		
	});
}

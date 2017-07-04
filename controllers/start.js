var debug = require('debug')('billing');
var config = require('../env/index');
var mailer = require('../modules/mailer');
var TmpUser = require('../models/tmpusers');
var CustomersService = require('../services/customers');
var SubscriptionsService = require('../services/subscriptions');
var BranchesService = require('../services/branches');
var translations = require('../translations/mailer.json');
var async = require('async');
var logger = require('../modules/logger').api;

module.exports = {
	newRequest: newRequest,
	setup: setup
};

function sendSuccessEmail(params, cb) {

	debug('sendSuccessEmail: ', params);

	mailer.send({
		from: {
			name: "Ringotel Service Support",
			address: "support@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].CONFIRM_ACCOUNT.SUBJECT,
		body: 'new_trial_request',
		lang: params.lang,
		name: params.name,
		link: config.apiGateway + '/api/setup?tid=' + params.token,
		template_id: '98ac2079-34b7-4e77-a872-c01ebf96fd32'
	}, function(err, result){
		debug('mailer result: ', err, result);
		if(err) return cb(err);
		cb();
	});
}

function newRequest(req, res, next) {
	var params = req.body;
	var newTmpUser = {};

	debug('start request add: ', params);

	CustomersService.get({ email: params.email }, function(err, customer) {
		if(err) return next(new Error(err));
		if(customer) return res.json({ success: false, message: 'CUSTOMER_EXISTS' });

		async.waterfall([
			function(cb) {
				// Validate branch prefix/domain
				BranchesService.isPrefixValid(params.domain, function(err, result) {
					if(err) return cb(err);
					if(!result) return cb('INVALID_PREFIX');
					cb();
				});
			},
			function(cb) {
				// Validate branch/company name
				BranchesService.isNameValid(params.company, function(err, result) {
					if(err) return cb(err);
					if(!result) return cb('BRANCH_NAME_EXISTS');
					cb();
				});
			},
			function(cb) {
				newTmpUser = new TmpUser(params)
				.save(function (err, tmpuser){
					debug('newTmpUser: ', err, tmpuser);
					if(err){
						if(err.code === 11000) {
							TmpUser.findOne({ email: params.email }, function(err, tmpuser) {
								sendSuccessEmail(tmpuser, function(err, result) {
									if(err) return cb(err);
									cb();
								});
							});
						} else {
							if(err) return cb(err);
						}
					} else {
						sendSuccessEmail(tmpuser, function(err, result) {
							if(err) return cb(err);
							res.json({success: true});
						});
					}
				});
			}
		], function(err, result) {
			if(err) {
				if(typeof err === 'string') res.json({ success: false, message: err });
				else next(new Error(err));
				return;
			}
				
			res.json({success: true});
		});
		
	});
	
}

function setup(req, res, next) {
	var token = req.query.tid;
	// var params = req.body;
	var userData = {};

	debug('token', token);
	if(!token) return cb('INVALID_TOKEN');

	async.waterfall([
		function(cb) {
			getTmpUser(token, function(err, user) {
				if(err) return cb(err);
				if(!user) return cb('INVALID_TOKEN');
				userData = user;
				cb(null, user);
			});
		},
		function(user, cb) {
			createCustomer(userData, function(err) {
				if(err) return cb(err);
				cb(null, userData);
			});
		},
		// createBranch,
		createSubscription

	], function(err, result) {
		debug('setup: ', err, result);
		if(err) return res.json({ success: false, message: err });
		res.redirect('https://'+userData.domain+'.ringotel.co') // redirect user to the branch domain
	});

}

function getTmpUser(token, cb) {
	TmpUser.findOne({token: token}, '-token -createdAt').lean().exec(function (err, user){
		if(err || !user) return cb(err || 'INVALID_TOKEN');
		cb(null, user);
	});
}

function createCustomer(params, cb) {

	debug('createCustomer: ', params);

	CustomersService.create(params, function(err, customer) {

		// remove tmp user
		TmpUser.findByIdAndRemove(params._id, function (err){
			if(err) logger.error(err);
		});

		debug('createCustomer created: ', customer);

		cb(null, customer);

	});
		
}

function createSubscription(customer, cb) {
	var planId = 'trial';
	var subParams = {
		// customer: customer,
		customerId: customer._id.toString(),
		sid: '59159374ef93e34d7f23be35', // Ukraine server
		// sid: '591d464a12254108560fb2f9', // Ireland server
		_subscription: {
			planId: planId,
			description: ('1-month subscription for "'+planId+'" plan. Users: 10. Company name: '+customer.company)
		},
		result: {
			admin: customer.name,
			email: customer.email,
			name: customer.company,
			prefix: customer.domain,
			adminname: customer.login,
			adminpass: customer.password,
			maxlines: 10,
			maxusers: 5,
			storelimit: 5,
			extensions: [{ firstnumber: 200, poolsize: 299 }],
			lang: 'en',
			timezone: 'UTC'
		}

	};

	debug('createSubscription: ', subParams);

	SubscriptionsService.createSubscription(subParams, function (err, result){
		if(err) return cb(err);
		cb(null, result);
	});
}

// function createBranch(params, cb) {

// 	var branchParams = {
// 		customerId: params._id,
// 		sid: '59159374ef93e34d7f23be35', // Ukraine server
// 		// sid: '591d464a12254108560fb2f9', // Ireland server
// 		params: {
			
// 		}
// 	};

// 	debug('createBranch: ', branchParams);

// 	return cb(null, { customerId: params._id }); // remove

// 	BranchesService.createBranch(branchParams, function(err, result) {
// 		if(err) return cb(err);
// 		cb(null, result);
// 	});
// }

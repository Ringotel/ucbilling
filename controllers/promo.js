var Promise = require('bluebird');
var BranchesService = require('../services/branches');
var PlansService = require('../services/plans');
var CustomersService = require('../services/customers');
var SubscriptionsService = require('../services/subscriptions');
var debug = require('debug')('billing');
var utils = require('../lib/utils');

var methods = {
	/**
	 * Create new customer without email validation
	 *
	 * @return {Object} New user parameters
	 * 
	 * @todo Add capcha (or similar) to mitigate bots attack
	 */
	promoSignUp: function(req, res, next){
		
		var params = req.body,
			newUserParams;

		if(!params.email || !params.password){
			res.status(400).json({
				success: false,
				message: "MISSING_FIELDS"
			});
			return;
		}

		newUserParams = {
			email: params.email,
			password: params.password,
			currency: 'UAH'
		};

		CustomersService.createPromise(newUserParams)
		.then(function (newCustomer){
			res.json({
				success: true,
				result: newCustomer
			});
		})
		.catch(function (err){
			next(new Error(err));
		});

	},

	/**
	 * Create subscription from the website.
	 * Subscription will be created with the "pending" state,
	 * until the subscriber confirms his/her email.
	 * 
	 * @param  {Object}   req  request object
	 * @param  {Object}   res  response object
	 * @param  {Function} next next function
	 * @return {[type]}        [description]
	 */
	createPromoSubscription: function(req, res, next){
		/**
		 * Subscription parameters
		 * 
		 * @type {Object}
		 *
		 * @param {String} customerId Customer ID
		 * @param {String}	planId	Plan ID
		 * @param {Array} addOns Array of addons for subscription
		 * @param {Boolean} trialOnly Specify whether subscription will be craeted without creditcard
		 */
		var params = req.body;
		var subParams = {
			customerId: params.customerId,
			planId: params.planId,
			// addOns: params.addOns,
			state: "pending"
		};
		// Enabling trialOnly on subscription in that way
		if(params.trialOnly) {
			subParams.billingPeriod = 0;
		}

		PlansService.getPromise({ _id: params.planId }, '-_id -__v -createdAt -updatedAt')
		.then(function (plan){
			debug('selected plan: %o', plan[0]);
			utils.deepExtend(subParams, plan[0]);
			// subParams.addOns = addOns;
			return subParams;
		})
		.then(SubscriptionsService.create)
		.then(function (sub){
			debug('promo subscription created: %o', sub);
			return;
			// Send email with instructions
		})
		.then(function (){
			res.json({
				success: true
			});
		})
		.catch(function (err){
			next(new Error(err));
		});

	},

	updateSubscription: function(req, res, next){

	}

};

module.exports = methods;
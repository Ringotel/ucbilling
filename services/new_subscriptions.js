var Subscription = require('../models/subscriptions');
var Plans = require('./plans');
var Addons = require('../services/addons');
var async = require('async');
var utils = require('../lib/utils');
var moment = require('moment');
var debug = require('debug')('billing');
var Big = require('big.js');

module.exports = {
	create: create
};

function create(params, cb) {
	var newSub = {},
		subParams = {
			planId: params.planId,
			customerId: params.customerId.toString(),
			description: params.description,
			_branch: params._branch,
			quantity: params.quantity,
			addOns: (params.addOns || [])
		};

	async.waterfall([
		function(cb) {
			extendAddOns(subParams.addOns, function(err, addOns) {
				if(err) return cb(err);
				subParams.addOns = addOns;
				cb(null, subParams);
			});
		},
		function(params, cb) {
			getPlan(params.planId, function(err, result) {
				if(err) return cb(err);
				cb(null, result);
			});
		},
		function(plan, cb) {
			subParams = utils.deepExtend(subParams, plan);
			if(plan.trialPeriod) {
				subParams.trialExpires = moment().add(plan.trialDuration, plan.trialDurationUnit).valueOf();
			} else {
				subParams.lastBillingDate = moment().add(plan.billingPeriod, plan.billingPeriodUnit).valueOf();
				subParams.billingCycles = moment(subParams.lastBillingDate).diff(moment(), 'days');

			}
			subParams.nextBillingDate = moment().add(1, 'day').valueOf();

			debug('create subParams: ', subParams);

			newSub = new Subscription(subParams)
			.validate(function(err) { debug('newSub validate err: ', err); })
			.countAmount();

			debug('subParams: %o', subParams);
			
			cb(null, newSub);
		}

	], function(err, result) {
		if(err) return cb(err);
		cb(null, result);
	});
}

function extendAddOns(addOns, cb){

	var addOnsKeys = Object.keys(addOns);
	if(addOnsKeys.length){
		Addons.getAll(function (err, result){
			if(err){
				cb(err);
				return;
			} else {
				addOnsKeys.forEach(function(key){
					if(result[key]) {
						addOns[key] = utils.deepExtend(result[key], addOns[key]);
					}
				});

				if(cb) cb(null, addOns);
			}
		});
	} else {
		if(cb) cb(null, addOnsKeys);
	}
}

function getPlan(planId, cb) {
	Plans.getOne({ planId: planId }, '-_state -_id -__v -createdAt -updatedAt -customData -description -name', function (err, result){
		if(err) return cb(err);
		cb(null, result);
	});
}
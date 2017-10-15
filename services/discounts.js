var async = require('async');
var debug = require('debug')('billing');
var logger = require('../modules/logger').api; 
var Customers = require('../models/customers');
var Discounts = require('../models/discounts');
var Coupons = require('../models/coupons');

module.exports = {

	add: function(params, callback) {
		var customer = null;
		var coupon = null;

		async.waterfall([
			function(cb) {
				Coupons
				.findOne({ name: params.coupon, $or: [ {expiresAt: { $gt: Date.now() }}, {neverExpires: true} ] })
				.then(result => {
					coupon = result;
					cb();
				})
				.catch(err => cb(err));

			}, function(cb) {
				Customers.findOne({ _id: params.customer })
				.then(function(result) {
					if(!result) return cb({ name: "EINVAL", message: "customer not found" })
					customer = result;
					cb();
				})
				.catch(err => cb(err));

			}, function(cb) {
				if(!coupon) return cb({ name: "EINVAL", message: "invalid coupon" });

				var discount = new Discounts({
					name: coupon.name,
					customer: params.customer,
					coupon: coupon
				});

				discount.save()
				.then(result => cb(null, result))
				.catch(err => {
					debug('add discount err: ', err);
					if(err.code === 11000) 
						return cb({ name: "EINVAL", message: "coupon already activated" });
					cb(err)
				});

			}, function(discount, cb) {
				customer.discounts.push(discount);
				customer.save()
				.then(result => cb(null, discount))
				.catch(err => cb(err));
			}

		], function(err, result) {
			if(err) return callback(err);
			debug('New discount created: %o', result);
			callback(null, result);
		});
	},

	get: function(params, callback) {
		Discounts.find(params)
		.then(result => {
			callback(null, result)
		})
		.catch(err => callback);
	}

};
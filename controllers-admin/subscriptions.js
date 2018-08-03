var Subscriptions = require('../models/subscriptions');
var dnsService = require('../services/dns');
var cti = require('../services/cti');

var methods = {

	getAll: function(req, res, next){
		Subscriptions
		.find()
		.populate('branch')
		.populate('customer')
		.lean()
		.limit(50)
		.sort('-nextBillingDate')
		.exec(function(err, result){
			if(err) return next(new Error(err));
			res.json(result);
		});
	},

	deleteById: function(req, res, next) {
		let sub = {};
		let requestParams = {};

		Subscriptions
		.findOne({ _id: req.params.id })
		.populate('branch')
		.then(result => {
			if(!result) return callback({ name: "EINVAL", message: "Branch not found" });
			sub = result;
			requestParams = {
				sid: result.branch.sid,
				data: {
					method: 'deleteBranch',
					params: { oid: result.branch.oid }
				}
			};

			cti.request(requestParams, function (err){
				if(err) return next(new Error(err));
				return dnsService.remove({ prefix: sub.branch.prefix });
			});
				
		})
		.then(() => {
			return sub.branch.remove()
		})
		.then(() => res.json({ success: true }))
		.catch(err => next(new Error(err)))
	}

};

module.exports = methods;

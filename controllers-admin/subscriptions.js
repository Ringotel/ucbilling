var Customers = require('../models/customers');
var Branches = require('../models/branches');
var Subscriptions = require('../models/subscriptions');

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
	}

	// deleteById: function(req, res, next) {
	// 	let sub = {};
	// 	let requestParams = {};

	// 	Subscriptions
	// 	.findOne({ _id: req.params.id })
	// 	.populate('branch')
	// 	.then(result => {
	// 		if(!result) return callback({ name: "EINVAL", message: "Branch not found" });
	// 		sub = result;
	// 		requestParams = {
	// 			sid: result.branch.sid,
	// 			data: {
	// 				method: 'deleteBranch',
	// 				params: { oid: result.branch.oid }
	// 			}
	// 		};

	// 		cti.request(requestParams, function (err){
	// 			if(err) return next(new Error(err));
	// 			return result.branch.remove();

				
	// 			.catch(err => callback(new Error(err)));
	// 		});
				
	// 	})
	// 	.then(() => {
	// 		dnsService.remove({ prefix: result.prefix })
	// 		.then(callback)
	// 		.catch(err => callback(new Error(err)));
	// 	})
	// 	.catch(err => next(new Error(err)))
	// }

};

module.exports = methods;

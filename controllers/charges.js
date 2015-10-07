var ChargesService = require('../services/charges');
var moment = require('moment');
var debug = require('debug')('billing');

module.exports = {
	
	get: function(req, res, next){
		//TODO - get only successed transactions
		var params = req.body,
			query = {
				customerId: params.customerId
			};
		

		if(params.start || params.end) {
			query.createdAt = {};
			if(params.start)
				query.createdAt['$gte'] = params.start;
			if(params.end)
				query.createdAt['$lte'] = params.end;
		}

		debug('Charges query: %o', query);

		ChargesService.get(query, (params.limit || 0), function (err, result){
			if(err) {
				return next(new Error(err));
			}
			res.json({
				success: true,
				result: result
			});
		});
	}
};
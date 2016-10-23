var TransactionsService = require('../services/transactions');
var moment = require('moment');
var debug = require('debug')('billing');

module.exports = {
	
	get: function(req, res, next){
		//TODO - get only successed transactions
		var params = req.body,
			query = {
				customerId: params.customerId,
				$or: [{ status: 'sandbox' }, { status: 'success' }]
			};
		

		if(params.start || params.end) {
			query.createdAt = {};
			if(params.start)
				query.createdAt['$gte'] = params.start;
			if(params.end)
				query.createdAt['$lte'] = params.end;
		}

		debug('Transaction query: %o', query);

		TransactionsService.get(query, (params.limit || 0), function (err, result){
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
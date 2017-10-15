var InvoicesService = require('../services/invoices');
var debug = require('debug')('billing');

module.exports = {
	
	get: function(req, res, next){
		var params = req.body;

		InvoicesService.get({ customer: params.customerId })
		.then(result => {
			res.json({ success: true, result: result }); 
		})
		.catch(err => {
			next(new Error(err));
		});
	}
};
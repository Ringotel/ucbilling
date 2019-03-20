var Partners = require('../models/partners');
var bcrypt = require('../services/bcrypt');
var debug = require('debug')('billing');

module.exports = {
	create
}

function create(req, res, next){
	var params = req.body;
	if(!params.email || !params.login || !params.name || !params.password){
		res.json({
			success: false,
			error: { name: "ERR_MISSING_ARGS", message: "MISSING_FIELDS" }
		});
		return;
	}
	Partners.findOne({ $or: [{ email: params.email }, { login: params.login }] }, function(err, customer){
		if(err){
			next(new Error(err));
		} else {
			if(customer){
				res.json({
					success: false,
					error: { name: "EINVAL", message: "CUSTOMER_EXISTS" }
				});
			} else {
				var partner;

				// bcrypt.hash(params.password, function(err, hash){
					
					// params.password = hash;
					params.currency = params.currency || 'EUR'; //TODO - determine currency base on the ip address or somehow

					debug('partner: ', params);

					partner = new Partners(params);
					partner.save(function (err, result){
						debug('partner: ', err, result);
						if(err){
							if(err.code === 11000) {
								res.json({
									success: false,
									error: { name: "EINVAL", message: "CUSTOMER_EXISTS" }
								});
							} else {
								next(new Error(err));
							}
						} else {
							res.json({success: true});
						}
					});
				// });
			}
		}
	});
}
var BranchesService = require('../services/branches');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');

var methods = {

	isPrefixValid: function(req, res, next){

		var params = req.body;

		BranchesService.isPrefixValid(params.prefix, function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}

			res.json({
				success: true,
				result: result
			});
		});

	},

	isNameValid: function(req, res, next){

		var params = req.body;
		BranchesService.isNameValid(params.name, function (err, result){
			if(err) {
				return res.json({
					success: false,
					message: err
				});
			}
			
			res.json({
				success: true,
				result: result
			});
		});

	},

	changePassword: function(req, res, next) {
		var params = req.body;
		if(!params.password) {
			return res.json({
				success: false,
				message: 'MISSING_FIELDS'
			});
		}

		BranchesService.changePassword({ _id: params.branchId, password: params.password }, function (err, result){
			if(err) return next(new Error(err));
			res.json({ success: true });
		});
	}

};

module.exports = methods;

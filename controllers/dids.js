var logger = require('../modules/logger').api;
var debug = require('debug')('billing');
var DidsService = require('../services/dids');

module.exports = { getCountries, getDids, orderDid, unassignDid };

function getCountries(req, res, next) {
	DidsService.getCountries(function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result.data });
	});
}

function getDids(req, res, next) {
	var params = req.body;

	DidsService.getDids(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true, result: result });
	});
	
}

function orderDid(req, res, next) {
	var params = req.body;

	DidsService.orderDid(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true, result: result });
	});
}

function unassignDid(req, res, next) {
	var params = req.body;

	DidsService.unassignDid(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true, result: result });
	});
}

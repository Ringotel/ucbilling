var logger = require('../modules/logger').api;
var debug = require('debug')('billing');
var DidsService = require('../services/dids');
var config = require('../env/index');
var Analytics = require('analytics-node');
var analytics = new Analytics(config.segmentKey);

module.exports = { 
	getCallingCredits, 
	addCallingCredits,
	getDid, 
	hasDids,
	getAssignedDids, 
	getCountries,
	getRegions,
	getLocations,
	getAvailableNumbers,
	getDidPrice, 
	orderDid, 
	updateStatus,
	updateRegistration,
	unassignDid,
	addNumbers
};

function getCallingCredits(req, res, next) {
	var params = req.body;

	DidsService.getCallingCredits({ customer: params.customerId })
	.then(result => {
		res.json({ success: true, result: result });
	})
	.catch(err => {
		if(err instanceof Error) return next(err);
		return res.json({ success: false, error: err });
	});
}

function addCallingCredits(req, res, next) {
	var params = req.body;

	DidsService.addCallingCredits(params)
	.then(result => {
		res.json({ success: true });

		analytics.track({
		  userId: params.customerId.toString(),
		  event: 'Calling Credits Added',
		  properties: {
		  	amount: params.amount
		  }
		});
	})
	.catch(err => {
		if(err instanceof Error) return next(err);
		return res.json({ success: false, error: err });
	});
}

function getDid(req, res, next) {
	var params = req.body;

	DidsService.getDid({ branch: params.branchId, number: params.number, assigned: true })
	.then(result => { res.json({ success: true, result: result }); })
	.catch(err => {
		if(err instanceof Error) return next(err);
		return res.json({ success: false, error: err });
	});
}

function hasDids(req, res, next) {
	var params = req.body;

	DidsService.hasDids({ branch: params.branchId })
	.then(result => { res.json({ success: true, result: result }); })
	.catch(err => {
		if(err instanceof Error) return next(err);
		return res.json({ success: false, error: err });
	});
}

function getAssignedDids(req, res, next) {
	var params = req.body;

	DidsService.getAssignedDids(params)
	.then(result => { res.json({ success: true, result: result }); })
	.catch(err => {
		if(err instanceof Error) return next(err);
		return res.json({ success: false, error: err });
	});
}

function getUnassignedDids(req, res, next) {
	var params = req.body;

	DidsService.getUnassignedDids(params)
	.then(result => { res.json({ success: true, result: result }); })
	.catch(err => {
		if(err instanceof Error) return next(err);
		return res.json({ success: false, error: err });
	});
}

function getCountries(req, res, next) {
	DidsService.getCountries(function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
}

function getRegions(req, res, next) {
	var params = req.body;

	DidsService.getRegions(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
}

function getLocations(req, res, next) {
	var params = req.body;

	DidsService.getLocations(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true, result: result });
	});
	
}

function getAvailableNumbers(req, res, next) {
	var params = req.body;

	DidsService.getAvailableNumbers(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true, result: result });
	});
}

function getDidPrice(req, res, next) {
	var params = req.body;

	DidsService.getDidPrice({ iso: params.iso, areaCode: params.areaCode }, function(err, result) {
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

		analytics.track({
		  userId: params.customerId.toString(),
		  event: 'DID Number Ordered'
		});
	});
}

function updateStatus(req, res, next) {
	var params = req.body;

	DidsService.updateStatus({ branch: params.branchId, number: params.number, assigned: true }, function(err ,result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true, result: result });	
	});
}

function updateRegistration(req, res, next) {
	var params = req.body;

	DidsService.updateRegistration({ branch: params.branchId, number: params.number, assigned: true }, function(err, result) {
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

		res.json({ success: true });

		analytics.track({
		  userId: params.customerId.toString(),
		  event: 'DID Number Deleted'
		});
	});
}

function addNumbers(req, res, next) {
	var params = req.body;

	DidsService.addNumbers(params, function(err, result) {
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}

		res.json({ success: true });
	})

}

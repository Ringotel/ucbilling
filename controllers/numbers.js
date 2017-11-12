var config = require('../env/index');
var NumbersService = require('../services/numbers');
var logger = require('../modules/logger').api;
var debug = require('debug')('billing');
var request = require('request');
var async = require('async');
var voxParams = config.voxbone;
var options = {
	headers: {
		'Content-type': 'application/json',
		'Accept': 'application/json'	
	},
	auth: {
		user: voxParams.login,
		pass: voxParams.password
	},
	json: true
};

module.exports = { getCountries, buyDids };

function getCountries(req, res, next) {
	options.url = voxParams.url+'inventory/country';
	options.qs = {
		'pageNumber': 0,
		'pageSize': 100
	};

	request.get(options, function(err, response, body) {
		if(err) return next(new Error(err));

		debug('getCountries api response: ', body);

		if(body.countries) {
			res.json({ success: true, result: body.countries });
		} else {
			res.json({ success: false });
		}
	});
}

function buyDids(req, res, next) {
	var params = req.body;
	var didGroup;
	var cartId;
	var orderReference;
	var dids;
	
	if(!params.countryCodeA3 || !params.areaCode) {
		return res.json({
			success: false,
			error: { name: 'ERR_MISSING_ARGS', message: 'missing params' }
		});
	}

	params.quantity = params.quantity || 1;

	async.waterfall([
		function(cb) {
			getDids({ 
				countryCodeA3: params.countryCodeA3, 
				areaCode: params.areaCode, 
				quantity: params.quantity

			}, function(err, response) {
				if(err) return cb(err);

				didGroup = response;
				cb();
			});
		},
		function(cb) {
			createCart({
				customerId: params.customerId

			}, function(err, response) {
				if(err) return cb(err);

				cartId = response;
				cb();
			});
		},
		function(cb) {
			addToCart({
				didId: didGroup.didGroupId,
				cartId: cartId,
				quantity: params.quantity

			}, function(err, response) {
				if(err) return cb(err);
				cb();
			});
		},
		function(cb) {
			checkoutCart({ cartId: cartId }, function(err, response) {
				if(err) return cb(err);

				orderReference = response;
				cb();
			});

		},
		function(cb) {
			listDids({ orderReference: orderReference }, function(err, response) {
				if(err) return cb(err);

				dids = response;
				cb();
			});
		}

	], function(err, result) {
		if(err) {
			return res.json({
				success: false,
				error: err
			});
		}

		res.json({ success: true, result: { orderReference: orderReference } });

	});

}

function getDids(params, callback) {

	options.url = voxParams.url+'inventory/didgroup';
	options.qs = {
		pageNumber: 0,
		pageSize: 20,
		countryCodeA3: params.countryCodeA3,
		areaCode: params.areaCode
	};

	request.get(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('getDids api error: ', body.errors[0].apiErrorMessage);
			return callback(body.errors[0].apiErrorMessage);
		}

		debug('getDids api response: ', body);

		if(body.didGroups) {
			let didGroup = body.didGroups.filter(item => { return item.stock > params.quantity });

			debug('getDids didGroup: ', didGroup);

			if(!didGroup.length) callback({ code: "OUT_OF_STOCK", message: 'Out of stock' });
			else callback(null, didGroup[0]);

		} else {
			callback(true); // TODO: add error message
		}
	});	
}

function createCart(params, callback) {
	options.url = voxParams.url+'ordering/cart';
	options.body = {
		customerReference: params.customerId,
		description: 'Cart #'+params.customerId
	};

	request.put(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('createCart api error');
			return callback(true);// TODO: add error message
		}

		debug('createCart api response: ', body);

		if(body.cart) {
			let cartId = body.cart.cartIdentifier;
			callback(null, cartId);

		} else {
			callback(true);// TODO: add error message
		}
	});	
}

function addToCart(params, callback) {
	options.url = voxParams.url+'ordering/cart/'+params.cartId+'/product';
	options.body = {
		didCartItem: {
			didGroupId: params.didId,
			quantity: params.quantity
		}
	};

	request.post(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('addToCart api error');
			return callback(true);// TODO: add error message
		}

		debug('addToCart api response: ', body);
		
		callback();

	});	
}

function checkoutCart(params, callback) {
	options.url = voxParams.url+'ordering/cart/'+params.cartId+'/checkout';
	options.qs = {
		cartIdentifier: params.cartId
	};

	request.get(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('checkoutCart api error');
			return callback(true);// TODO: add error message
		}

		debug('checkoutCart api response: ', body);
		
		if (body.status == 'WARNING' && body.productCheckoutList){
			return calback(body.productCheckoutList[0].message);
		}

		if(body.status === 'SUCCESS' && body.productCheckoutList) {
			callback(null, body.productCheckoutList[0].orderReference);
		} else {
			callback(true);// TODO: add error message
		}

	});
}

function listDids(params, callback) {
	options.url = voxParams.url+'inventory/did';
	options.qs = {
		pageNumber: 0,
		pageSize: 50,
		reference: params.orderReference
	};

	request.get(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('listDids api error');
			return callback(true);// TODO: add error message
		}

		debug('listDids api response: ', body);
		
		if(body.dids) {
			callback(null, body.dids);
		} else {
			callback(true);// TODO: add error message
		}

	});
}

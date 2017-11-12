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

var methods = { getCountries, buyDids };

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
	
	async.waterfall([
		function(cb) {
			getDids({ 
				country: params.country, 
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
			checkoutCart(cartId, function(err, response) {
				if(err) return cb(err);
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


	});

}

function getDids(params, callback) {

	options.url = voxParams.url+'inventory/didgroup';
	options.qs = {
		'pageNumber': 0,
		'pageSize': 20,
		'countryCodeA3': params.country,
		'areaCode': params.areaCode
	};

	request.get(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('getDids api error: ', body.errors[0].apiErrorMessage);
			return callback(body.errors[0].apiErrorMessage);
		}

		debug('getDids api response: ', body);

		if(body.didGroups) {
			let didGroup = body.didGroups.filter(item => { item.stock > params.quantity })[0];

			if(!didGroup) callback({ code: "OUT_OF_STOCK", message: 'Out of stock' });
			else callback(null, didGroup);

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
	options.url = voxParams.url+'ordering/cart/'+cartId+'/product';
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

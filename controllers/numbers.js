var config = require('../env/index');
// var NumbersService = require('../services/numbers');
var BranchService = require('../services/branches');
var logger = require('../modules/logger').api;
var cti = require('../services/cti');
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
	var branch = {};
	var didGroup;
	var cartId;
	var orderReference;
	var dids;
	var didIds;
	
	if(!params.countryCodeA3 || !params.areaCode) {
		return res.json({
			success: false,
			error: { name: 'ERR_MISSING_ARGS', message: 'missing params' }
		});
	}

	params.quantity = params.quantity || 1;

	async.waterfall([
		function(cb) {
			// BranchService.get({ customer: params.customerId, oid: params.branchId })
			BranchService.get({ customer: params.customerId, oid: "1234567890" }) // TEST
			.then(result => {
				if(!result) return cb({ name: 'ENOENT', message: 'branch not found' });
				branch = result;
				cb();
			})
			.catch(cb);
		},
		function(cb) {
			getDids({ 
				countryCodeA3: params.countryCodeA3, 
				areaCode: params.areaCode, 
				quantity: params.quantity

			}, function(err, result) {
				if(err) return cb(err);

				didGroup = result;
				cb();
			});
		},
		function(cb) {
			createCart({
				customerId: params.customerId

			}, function(err, result) {
				if(err) return cb(err);

				cartId = result;
				cb();
			});
		},
		function(cb) {
			addToCart({
				didId: didGroup.didGroupId,
				cartId: cartId,
				quantity: params.quantity

			}, function(err, result) {
				if(err) return cb(err);
				cb();
			});
		},
		function(cb) {
			checkoutCart({ cartId: cartId }, function(err, result) {
				if(err) return cb(err);

				orderReference = result;
				cb();
			});

		},
		function(cb) {
			listDids({ orderReference: orderReference }, function(err, result) {
				if(err) return cb(err);

				dids = result;
				didIds = dids.reduce((prev, next) => {
					prev.push(next.didId);
					return prev;
				}, []);
				cb();
			});
		},
		function(cb) {
			// create routes on cti server
			async.each(dids, function(item, cb2) {
				createCtiRoute({
					number: item.e164,
					uri: item.e164+'@'+branch.prefix+'.'+config.domain,
					branch: {
						oid: branch.oid,
						sid: branch.sid,
						prefix: branch.prefix
					}
				}, function(err, result) {
					if(err) return cb2(err);
					cb2();
				});
			}, function(err, result) {
				if(err) {
					cancelDids(didIds);
					return cb(err);
				}
				cb();
			});
		},
		function(cb) {
			// check or create sip uris and link them to didIds
			async.each(dids, function(item, cb2) {
				let uri = item.e164+'@'+branch.prefix+'.'+config.domain;

				async.waterfall([
					function(cb3) {
						checkUri({ uri: uri, }, function(err, result) {
							if(err) return cb3(err);

							cb3(null, result);
						});
					},
					function(uriId, cb3) {
						if(uriId) return cb3(null, uriId);
						createUri({ uri: uri }, function(err, result) {
							if(err) return cb3(err);
							cb3(null, result);
						});
					},
					function(uriId, cb3) {
						linkUri({ didIds: [ item.didId.toString() ], voiceUriId: uriId.toString() }, function(err, result) {
							if(err) return cb3(err);
							cb3();
						});
					}
				], function(err, result) {
					if(err) return cb2(err);
					cb2();
				});
						

			}, function(err, result) {
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
			logger.error('createCart api error: ', err);
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
			logger.error('addToCart api error: ', err);
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
			logger.error('checkoutCart api error: ', err);
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
			logger.error('listDids api error: ', err);
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

function createCtiRoute(params, callback) {
	var requestParams = {
		sid: params.branch.sid,
		data: { method: 'setRoute' },
		params: {
			oid: params.branch.oid,
			number: params.number,
			description: 'Voxbone to branch '+params.number,
			target: { oid: params.uri }	
		}
	};

	debug('createCtiRoute: ', params);

	return callback(); // TEST

	cti.request(requestParams, function (err, response){
		if(err) {
			debug('createCtiRoute error: ', err);
			return callback(err);
		}
		
		debug('createCtiRoute result: ', response);
		callback();
	});
}

function checkUri(params, callback) {
	options.url = voxParams.url+'configuration/voiceuri';
	options.qs = {
		pageNumber: 0,
		pageSize: 1,
		uri: params.uri
	};

	request.get(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('checkUri api error: ', err);
			return callback(true);// TODO: add error message
		}

		debug('checkUri api response: ', body);
		if(body.voiceUris[0]) {
			callback(null, body.voiceUris[0].voiceUriId);
		} else {
			callback();
		}

	});
}

function createUri(params, callback) {
	options.url = voxParams.url+'configuration/voiceuri';
	options.body = {
		voiceUri: {
			voiceUriProtocol : "SIP", 
			uri: params.uri,
			description : "VoiceUri: "+params.uri
		}
	};

	request.put(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('createUri api error: ', err);
			return callback(true);// TODO: add error message
		}

		debug('createUri api response: ', body);
		
		callback(null, body.voiceUri.voiceUriId);

	});
}

function linkUri(params, callback) {
	options.url = voxParams.url+'configuration/configuration';
	options.body = {
		didIds: params.didIds,
		voiceUriId: params.voiceUriId,
		webRtcEnabled: params.webRtcEnabled
	};

	debug('linkUri options: ', options);

	request.post(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('linkUri api error: ', err, response.statusCode);
			return callback({ code: "ERR_SERVICE_API", message: err });// TODO: add error message
		}

		debug('linkUri api response: ', body);
		
		callback();

	});
}

function cancelDids(didIds, callback) {
	options.url = voxParams.url+'ordering/cancel';
	options.body = { didIds: didIds };

	// TODO delete routes

	request.post(options, function(err, response, body) {
		if(err || response.statusCode !== 200) {
			logger.error('cancelDids api error: ', err);
			if(callback) callback(true);// TODO: add error message
			return;
		}

		debug('cancelDids api response: ', body);
		
		if(callback) callback();

	});
}

var debug = require('debug')('billing');
var async = require('async');
var request = require('request');
var async = require('async');
var moment = require('moment');
var Big = require('big.js');
var config = require('../env/index');
var logger = require('../modules/logger').api;
var Dids = require('../models/dids');
var Invoices = require('../models/invoices');
var Subscriptions = require('../models/subscriptions');
var SubscriptionsService = require('./subscriptions');
var InvoicesService = require('./invoices');
var CustomersService = require('./customers');
var reqOpts = {
	json: true,
	baseUrl: config.didww.url,
	headers: {
		'Content-Type': 'application/vnd.api+json',
		'Accept': 'application/vnd.api+json',
		'Api-Key': config.didww.apiKey
	}
};

module.exports = { getCountries, getDids, orderDid, assignDid, unassignDid };

function hasDids(params) {
	return Dids.count(params);
}

function getCountries(callback) {
	var countries = 'US,GB,UA,IE,DE';

	reqOpts.url = 'countries?filter[iso]='+countries;

	didwwRequest('GET', 'countries', null, { filters: [{ key: 'iso', value: countries }] }, function(err, result) {
		if(err) return callback(err);
		callback(null, result);
	});
}

function getDids(params, callback) {
	async.waterfall([
		function(cb) {
			didwwRequest('GET', 'did_group_types', null, { filters: [{ key: 'name', value: 'Local' }] }, function(err, result) {
				if(err) return cb(err);
				cb(null, result.data[0].id);
			});
		},
		function(typeId, cb) {
			didwwRequest(
				'GET', 
				'did_groups', 
				null, 
				{ 
					'page[size]': '550', 
					filters: [{ key: 'is_available', value: true, key: 'country.id', value: params.countryId }, { key: 'did_group_type.id', value: typeId }] 
				},
				function(err, result) {
					if(err) cb(err);

					let list = result.data.map(item => {
						return {
							id: item.id,
							areaCode: item.attributes.prefix,
							areaName: item.attributes.area_name,
							needRegistration: item.meta.needs_registration,
							restrictions: item.meta.restrictions
						};
					});

					cb(null, list);
				}

			);
		}
	], function(err, result) {
		if(err) callback(err);
		callback(null, result);
	});
	
}

function getPriceObject(params) {
	debug('DidsService getPriceObject: ', params);
	return Promise.resolve({
		// countryCode: 353,
		// city: 'Dublin',
		// areaCode: 1,
		currency: 'EUR',
		pricePerMonth: '5.0',
		pricePerYear: '36.0'
	});
}

function orderDid(params, callback) {
	var sku_id = null;
	var sub = null;
	var isTrial = false;
	var customer = null;
	var order = null;
	var trunk = null;
	var price = null;

	async.waterfall([
		function(cb) {
			// get subscription
			SubscriptionsService.get({ customer: params.customerId, branch: params.branchId }, function(err, result) {
				if(err) return cb(err);
				if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', branch: params.branchId });
				debug('DidsController orderDid sub: ', result);
				sub = result;
				isTrial = sub.plan.numId === 0 || sub.plan.planId === 'trial';
				cb();
			});
		},
		function(cb) {
			// check if plan is trial
			if(isTrial && sub.plan.attributes.maxnumbers !== undefined) { 
				let maxnumbers = sub.plan.attributes.maxnumbers;

				// check if subscription has dids
				hasDids({ subId: sub._id })
				.then(result => {
					debug('DidsController orderDid hasDids: ', result);
					if(maxnumbers && result > maxnumbers) cb({ name: 'ECANCELED', message: 'Can\'t buy DID. The limit is exceeded for this subscription.' });
					else cb();
				})
				.catch(err => cb(err));
			} else {
				cb();
			}
		},
		function(cb) {
			// get DID group
			getDidGroup(params, function(err, result) {
				if(err) {
					cb(err);
				} else if(!result || !result.data || !result.data.length) {
					cb({ name: 'ENOENT', message: 'DID is not available', params: params });
				} else {
					debug('DidsController orderDid getDidGroups: ', result);
					sku_id = result.included.filter(item => { return item.attributes.channels_included_count === 2 })[0];
					sku_id = sku_id ? sku_id.id : null;
					debug('DidsController orderDid sku_id: ', sku_id);
					if(!sku_id) cb({ name: 'ENOENT', message: 'stock_keeping_units not found' });
					else cb();
				}
			});
		},
		function(cb) {
			// get DID price object
			getPriceObject({ countryCode: params.countryPrefix, areaCode: params.areaCode })
			.then(result => {
				if(!result) return cb({ name: 'ENOENT', message: 'did price object not found' });
				cb(null, result);
			})
			.catch(err => cb(err));
		},
		function(priceObject, cb) {

			// if plan is trial and maxnumbers is not reached - do not charge
			if(isTrial) return cb();

			price = sub.plan.billingPeriodUnit === 'years' ? priceObject.pricePerYear : priceObject.pricePerMonth;
			debug('DidsController orderDid getPriceObject: ', price, priceObject);

			// count amount
			debug('DidsController orderDid price: ', price);
			let cycleDays = moment(sub.nextBillingDate).diff(moment(sub.prevBillingDate), 'days');
			let proratedDays = moment(sub.nextBillingDate).diff(moment(), 'days');
			let prorationRatio = Big(proratedDays).div(cycleDays);
			let amount = Big(price).times(prorationRatio);
			let proratedAmount = Big(price).minus(amount);

			// create and pay invoice
			let invoice = new Invoices({
				customer: params.customerId,
				subscription: sub._id,
				currency: sub.plan.currency,
				items: [{
					description: 'Subscription for DID number',
					amount: amount.toFixed(2),
					proratedAmount:  proratedAmount.toFixed(2)
				}]
			});

			// InvoicesService.pay(invoice)
			// .then(result => {
				debug('DidsController orderDid invoice payed: ', amount);
				cb();
			// })
			// .catch(err => cb(err));
		},
		function(cb) {
			// create DID order
			let data = {
				type: "orders",
				attributes: {
					allow_back_ordering: false,
					items: [
						{
							type: 'did_order_items',
							attributes: {
								qty: 1,
								sku_id: sku_id
							}
						}
					]
				}
			};

			debug('DidsController orderDid createOrder data: ', sku_id, data);

			createOrder(data, function(err, result) {
				if(err) return cb(err);
				debug('DidsController orderDid createOrder: ', result);
				order = result.data;
				cb(null, order.id);
			});
		},
		function(orderId, cb) {
			// get DID number by order id
			getDidNumber(orderId, function(err, result) {
				if(err) return cb(err);
				if(!result || !result.data || !result.data.length) cb({ name: 'ENOENT', message: 'did not found', order_id: orderId });
				let did = result.data[0];
				debug('DidsController orderDid getDidNumber: ', did);
				cb(null, did);
			});
		},
		function(did, cb) {
			let didParams = {
				subscription: sub._id,
				orderId: order.id,
				didId: did.id,
				number: did.attributes.number,
				type: params.type,
				awaitingRegistration: did.awaiting_registration,
				status: did.awaiting_registration ? 'pending' : 'active',
				countryPrefix: params.countryPrefix,
				areaCode: params.areaCode,
				currency: sub.plan.currency,
				price: price
			};

			new Dids(didParams).save()
			.then(result => { cb(null, result) })
			.catch(err => {
				// amount already paid - do not return error
				logger.error('did.service Dids.save error: %j, params: %j', err, didParams);
				cb(err);
			});
		},
		function(did, cb) {
			assignDid({ host: (sub.branch.prefix+'.'+config.domain), didId: did.didId }, function(err, result) {
				if(err){
					// amount already paid - do not return error
					logger.error('did.service assignDid error: %j, params: %j', err, did);
					return cb(err);
				}

				// return did
				cb(null, did);
			});
		}

	], function(err, result) {
		if(err) return callback(err);
		callback(null, result);
	});
}

function assignDid(params, callback) {
	async.waterfall([
			
		function(cb) {
			// get trunk
			getTrunks({ name: params.host }, function(err, result) {
				if(err || !result || !result.data || !result.data.length) return cb(null, null);
				cb(null, result.data[0])
			});
		},
		function(trunk, cb) {
			// create Trunk and point it to the branch domain
			
			if(trunk) return cb(null, trunk);

			createTrunk({ host: params.host }, function(err, result) {
				if(err) return cb(err);
				debug('DidsController orderDid createTrunk: ', result);
				cb(null, result.data);
			});
		},
		function(trunk, cb) {
			// connect DID number to the Trunk
			let data = {
				id: params.didId,
				type: 'dids',
				attributes: {
					capacity_limit: 100
				},
				relationships: {
					trunk: {
						data: {
							type: 'trunks',
							id: trunk.id
						}
					}
				}
			};

			updateDid(params.didId, data, function(err, result) {
				if(err) return cb(err);
				debug('DidsService orderDid updateDid: ', result);
				cb(null, result.data, trunk); // everything ok - return did number
			});
		},
		function(did, trunk, cb) {
			Dids.update({ didId: params.didId }, { $set: { trunkId: trunk.id, assigned: true } })
			.then(result => cb())
			.catch(err => cb(err));
		}
	], function(err, result) {
		if(err) return callback(err);
		callback(null, result);
	});
}

function unassignDid(params, callback) {
	async.waterfall([
			
		function(cb) {
			// connect DID number to the Trunk
			let data = {
				id: params.didId,
				type: 'dids',
				relationships: {
					trunk: {
						data: {
							type: 'trunks',
							id: ""
						}
					}
				}
			};

			updateDid(params.didId, data, function(err, result) {
				if(err) return cb(err);
				debug('DidsService orderDid updateDid: ', result);
				cb(null, result.data); // everything ok - return did number
			});
		},
		function(did, cb) {
			Dids.update({ didId: params.didId }, { $set: { assigned: false } })
			.then(result => cb())
			.catch(err => cb(err));

		}
	], function(err, result) {
		if(err) return callback(err);
		callback(null, result);
	});
}

function createOrder(params, callback) {
	debug('createOrder reqOpts: ', reqOpts);

	didwwRequest('POST', 'orders', params, callback);
}

function getDidGroup(params, callback) {
	didwwRequest(
		'GET', 
		'did_groups', 
		null, 
		{
			include: 'country,city,stock_keeping_units',
			filters: [{ key: 'is_available', value: true }, { key: 'country.id', value: params.countryId }, { key: 'prefix', value: params.areaCode }]
		},
		callback
	);
}

function getDidNumber(orderId, callback) {

	debug('getDidNumber reqOpts: ', reqOpts);

	didwwRequest('GET', 'dids', null, { filters:[{ key: 'order.id', value: orderId }] }, callback);
}

function updateDid(didId, data, callback) {
	debug('updateDid reqOpts: ', didId, reqOpts);

	didwwRequest('PATCH', 'dids/'+didId, data, callback);
}

function createTrunk(params, callback) {
	var branchHost = params.host;
	var data = {
		type: "trunks",
		attributes: {
			priority: '1',
			weight: '2',
			capacity_limit: 200,
			ringing_timeout: 32,
			name: branchHost,
			preferred_server: 'LOCAL',
			cli_format: 'e164',
			cli_prefix: '',
			description: 'Trunk to '+branchHost,
			configuration: {
				type: 'sip_configurations',
				attributes: {
					host: branchHost,
					transport_protocol_id: 1
				}
			}
		}
	};

	didwwRequest('POST', 'trunks', data, callback);
}

function getTrunks(params, callback) {
	didwwRequest('GET', 'trunks', null, { filters:[{ key: 'name', value: params.name }] }, callback);
}

function deleteTrunk(id, callback) {
	didwwRequest('DELETE', 'trunks'+id, callback);
}

function didwwRequest(method, path, data, attributes) {
	var lastArg = arguments[arguments.length-1];
	var callback = null;

	if(typeof lastArg === 'function') callback = lastArg;

	reqOpts.method = method;
	reqOpts.url = path;

	if(Object.keys(attributes).length) reqOpts.url += '?';

	if(data && (typeof data !== 'function'))
		reqOpts.body = { data: data };

	if(attributes && (typeof attributes !== 'function')) {
		for(let key in attributes) {
			if(key === 'filters') {
				let filterStr = attributes[key].reduce(function(prev, next){ 
					prev += '&filter[' + next.key + ']=' + next.value;
					return prev;
				}, '');

				reqOpts.url += filterStr;
			} else {
				reqOpts.url += '&'+key+'=' + attributes[key];
			}
		}
	}

	request(reqOpts, function(err, response, body) {
		debug('didwwRequest request: ', reqOpts);
		debug('didwwRequest response: ', err, body);
		if(!callback) return;
		if(err) callback(err);
		else if(body && body.errors) callback(body.errors[0]);
		else callback(null, body);
	});		
}

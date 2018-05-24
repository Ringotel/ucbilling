var debug = require('debug')('billing');
var async = require('async');
var request = require('request');
var async = require('async');
var moment = require('moment');
var Big = require('big.js');
var config = require('../env/index');
var logger = require('../modules/logger').api;
var Dids = require('../models/dids');
var DidsPrice = require('../models/dids_pricelist');
var Invoices = require('../models/invoices');
var Subscriptions = require('../models/subscriptions');
// var SubscriptionsService = require('./subscriptions');
var InvoicesService = require('./invoices');
var CustomersService = require('./customers');
var SipBillingService = require('./sipbilling');
var reqOpts = {
	json: true,
	baseUrl: config.didww.url,
	headers: {
		'Content-Type': 'application/vnd.api+json',
		'Accept': 'application/vnd.api+json',
		'Api-Key': config.didww.apiKey
	}
};

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
	assignDid, 
	updateStatus,
	updateRegistration,
	unassignDid
};

function getCallingCredits(params) {
	return SipBillingService.getBalance(params);
}

function addCallingCredits(params, callback) {
	return new Promise((resolve, reject) => {
		async.waterfall([
			function(cb) {
				Subscriptions.findOne({ customer: params.customerId, branch: params.branchId })
				.then(result => { 
					if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', branch: params.branchId });
					cb(null, result);
				})
				.catch(err => cb(err));
			},
			function(sub, cb) {
				debug('addCallingCredits sub: ', sub, sub.plan.currency);

				// create and pay invoice
				let invoice = new Invoices({
					customer: params.customerId,
					subscription: sub._id,
					currency: sub.plan.currency,
					items: [{
						description: 'Calling credits',
						amount: params.amount.toFixed(2)
					}]
				});

				debug('invoice: ', invoice);

				InvoicesService.pay(invoice)
				.then(result => {
					debug('addCallingCredits invoice payed: ', params.amount);
					cb();
				})
				.catch(err => cb(err));
			},
			function(cb) {
				// get current balance
				getCallingCredits({ customer: params.customerId })
				.then(result => cb(null, result.balance))
				.catch(err => cb(err));
			},
			function(balance, cb) {
				// set new balance
				let newBalance = Big(params.amount).plus(balance).toFixed(0);
				debug('addCallingCredits newBalance: ', params.amount, balance, newBalance);
				SipBillingService.setBalance({ customer: params.customerId, balance: parseInt(newBalance, 10) })
				.then(result => {
					cb();
				})
				.catch(err => cb(err));
			}
		], function(err) {
			if(err) return reject(err);
			resolve();
		});
	});
}

function getDid(params) {
	debug('getDid: ', params);
	return Dids.findOne(params);
}

function hasDids(params, callback) {
	return Dids.count({ branch: params.branch });
}

function getAssignedDids(params, callback) {
	return Dids.find({ branch: params.branchId, assigned: true });
}

function getUnassignedDids(params, callback) {
	return Dids.find({ branch: params.branchId, assigned: false });
}

function getCountries(callback) {
	// List of allowed countries (iso)
	var countries = 'US,GB,IE,DE,AR,AU,BE,BR,BG,CA,CL,CO,HR,CZ,FI,FR,HU,IL,IT,LV,LT,MX,NL,NZ,NO,PE,PL,PR,RO,SK,SI,ES,SE,CH,ZA';

	didwwRequest('GET', 'countries', null, { filters: [{ key: 'iso', value: countries }] }, function(err, result) {
	// didwwRequest('GET', 'countries', null, function(err, result) {
		if(err) return callback(err);
		if(!result || !result.data) return callback({ name: 'ENOENT', message: 'countries not found' });
		// let list = result.data.map(item => item.attributes);
		callback(null, result.data);
	});
}

function getRegions(params, callback) {
	debug('getRegions params: ', params);

	didwwRequest(
		'GET', 
		'regions', 
		null, 
		{ 
			filters: [{ key: 'country.id', value: params.country }] 
		},
		function(err, result) {
			if(err) return callback(err);

			debug('getRegions result: ', err, result);

			callback(null, result.data || []);
		}

	);
}

function getLocations(params, callback) {
	// DidsPrice.find({ prefix: params.prefix, type: params.type })
	// .then(result => callback(null, result))
	// .catch(err => callback(err));

	async.waterfall([
		function(cb) {
			didwwRequest('GET', 'did_group_types', null, { filters: [{ key: 'name', value: params.type }] }, function(err, result) {
				if(err) return cb(err);
				cb(null, result.data[0].id);
			});
		},
		function(typeId, cb) {
			let filters = [{ key: 'is_available', value: true, key: 'country.id', value: params.country }, { key: 'did_group_type.id', value: typeId }];
			if(params.region) filters.push({ key: 'region.id', value: params.region });

			didwwRequest(
				'GET', 
				'did_groups', 
				null, 
				{ 
					'page[size]': '800', 
					filters: filters 
				},
				function(err, result) {
					if(err) cb(err);

					let list = result.data.map(item => {
						return {
							_id: item.id,
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

function getAvailableNumbers(params, callback) {
	debug('getAvailableNumbers params: ', params);

	didwwRequest(
		'GET', 
		'available_dids', 
		null, 
		{ 
			filters: [{ key: 'did_group.id', value: params.dgid }] 
		},
		function(err, result) {
			if(err) return callback(err);

			debug('getAvailableNumbers result: ', err, result);

			callback(null, result.data || []);
		}

	);
}

function getDidPrice(params, callback) {
	DidsPrice.findOne(params)
	.then(result => {
		debug('getDidPrice result: ', params, result);
		callback(null, result)
	})
	.catch(err => callback(err));
}

function orderDid(params, callback) {
	var sku_id = null;
	var sub = null;
	var isTrial = false;
	var customer = null;
	var order = null;
	var trunk = null;
	var price = null;
	var priceObject = {};

	async.waterfall([
		function(cb) {
			// get subscription
			Subscriptions.findOne({ customer: params.customerId, branch: params.branchId })
			.populate('branch')
			.select('-branch.adminname -branch.adminpass')
			.then(result => {
				if(!result) return cb({ name: 'ENOENT', message: 'subscription not found', branch: params.branchId });
				debug('DidsController orderDid sub: ', result);
				sub = result;
				isTrial = sub.plan.numId === 0 || sub.plan.planId === 'trial';
				cb();
			})
			.catch(err => cb(err));
		},
		function(cb) {
			// return if sip billing account is already created
			if(sub.hasDids) return cb();

			debug('SipBillingService createAccount:', params.customerId);
			// create new sip billing account
			SipBillingService.createAccount({ customer: params.customerId })
			.then(result => cb())
			.catch(err => cb(err));
		},
		function(cb) {
			// check if plan is trial
			
			var maxdids = (sub.plan.attributes ? sub.plan.attributes.maxdids : sub.plan.customData.maxdids) || 1;
			
			if(isTrial && maxdids) {

				// check if a number of DIDs 
				// is less or equal to maxdids parameter
				hasDids({ branch: sub.branch._id })
				.then(result => {
					debug('DidsController orderDid hasDids: ', result);
					if(result >= maxdids) cb({ name: 'ECANCELED', message: 'Can\'t buy DID. The limit is exceeded for this subscription.' });
					else cb();
				})
				.catch(err => cb(err));
			} else {
				cb();
			}
		},
		function(cb) {
			// get price object where "poid" - price object id
			DidsPrice.findById({ _id: params.poid })
			.then(result => {
				if(!result) return cb({ name: 'ENOENT', message: 'DID is not available', branch: params.branchId });
				priceObject = result;
				price = sub.plan.billingPeriodUnit === 'years' ? priceObject.annualPrice : priceObject.monthlyPrice;
				debug('DidsController orderDid price: ', price, priceObject);
				cb();
			})
			.catch(err => cb(err));
		},
		function(cb) {
			// get DID group and "skuid", where "dgid" - did group id
			getDidGroup(params.dgid, function(err, result) {
				if(err) {
					cb(err);
				} else if(!result || !result.data) {
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

			// if plan is trial and maxdids is not reached - do not charge
			if(isTrial) return cb();

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

			InvoicesService.pay(invoice)
			.then(result => {
				debug('DidsController orderDid invoice payed: ', amount);
				cb();
			})
			.catch(err => cb(err));
		},
		function(cb) {
			// create DID order
			let didOrderItems = {};
			let data = {};

			didOrderItems = {
				type: 'did_order_items',
				attributes: {
					sku_id: sku_id
				}
			};

			if(params.anid) {
				didOrderItems.attributes.available_did_id = params.anid;
			} else {
				didOrderItems.attributes.qty = 1;
			}
			
			data = {
				type: "orders",
				attributes: {
					allow_back_ordering: false,
					items: [didOrderItems]
				}
			};

			debug('DidsController orderDid createOrder data: ', sku_id, data, didOrderItems);

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
				branch: sub.branch._id,
				orderId: order.id,
				didId: did.id,
				awaitingRegistration: did.attributes.awaiting_registration,
				status: (order.status === 'Completed' ? 'active' : 'pending'),
				currency: sub.plan.currency,
				number: did.attributes.number,
				monthlyPrice: priceObject.monthlyPrice,
				annualPrice: priceObject.annualPrice,
				type: priceObject.type,
				formatted: formatNumber(priceObject.prefix, priceObject.areaCode, did.attributes.number),
				prefix: priceObject.prefix,
				country: priceObject.country,
				areaCode: priceObject.areaCode,
				areaName: priceObject.areaName,
				restrictions: priceObject.restrictions,
				included: isTrial ? true : false
			};

			new Dids(didParams).save()
			.then(result => cb(null, result))
			.catch(err => {
				// amount already paid - do not return error
				logger.error('did.service Dids.save error: %j, params: %j', err, didParams);
				cb(err);
			});
		},
		function(did, cb) {
			// assignDid({ host: (sub.branch.prefix+'.'+config.domain), didId: did.didId }, function(err, result) {
			assignDid({ host: (sub.branch.prefix+'-'+did.number), didId: did.didId }, function(err, result) {
				if(err){
					// amount already paid - do not return error
					logger.error('did.service assignDid error: %j, params: %j', err, did);
					return cb(err);
				}

				// return did
				cb(null, did);
			});
		},
		function(did, cb) {
			// create record in callerid table
			debug('SipBillingService addNumber:', did.number);
			SipBillingService.addNumber({ customer: params.customerId, number: did.number })
			.then(result => cb(null, did))
			.catch(err => cb(err));
		},
		function(did, cb) {
			// if(isTrial) return cb(null, did);
			sub.hasDids = true;
			sub.save()
			.then(() => { cb(null, did); })
			.catch(err => cb(err));
		}

	], function(err, result) {
		if(err) return callback(err);
		callback(null, result);
	});
}

function formatNumber(prefix, areaCode, number) {
	var num = number.substr((prefix+areaCode).length);
	num = (num.slice(0, 3) + "-" + num.slice(3));
	return ("+" + prefix + " ("+areaCode+") " + num);
}

function assignDid(params, callback) {
	async.waterfall([
			
		// function(cb) {
		// 	// get trunk
		// 	getTrunks({ name: params.host }, function(err, result) {
		// 		if(err || !result || !result.data || !result.data.length) return cb(null, null);
		// 		cb(null, result.data[0])
		// 	});
		// },
		function(cb) {
			// create Trunk and point it to the branch domain
			
			// if(trunk) return cb(null, trunk);

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
		
		function(cb){
			Dids.findOne({ branch: params.branchId, number: params.number })
			.then(did => cb(null, did))
			.catch(err => cb(err));
		},
		// function(did, cb) {
		// 	// connect DID number to the Trunk
		// 	let data = {
		// 		id: did.didId,
		// 		type: 'dids',
		// 		attributes: {
		// 			terminated: true
		// 		}
		// 	};

		// 	updateDid(did.didId, data, function(err, result) {
		// 		if(err) return cb(err);
		// 		debug('DidsService unassignDid updateDid: ', result);
		// 		cb();
		// 	});
		// },
		// function(did, cb) {
		// 	if(did.awaitingRegistration) {
		// 		deleteOrder(did.orderId, function(err, result){
		// 			if(err) return cb(err);
		// 			cb(null, did);
		// 		});
		// 	} else {
		// 		cb(null, did);
		// 	}
		// },
		function(did, cb) {
			updateTrunk(did.trunkId, {
				id: did.trunkId,
				type: "trunks",
				attributes: {
					cli_prefix: "01616"
				}
			}, function(err, result) {
				if(err) return cb(err);
				cb(null, did);
			});
		},
		function(did, cb) {
			debug('SipBillingService deleteNumber:', did.number);
			SipBillingService.deleteNumber({ customer: params.customerId, number: did.number })
			.then(result => cb(null, did))
			.catch(err => cb(err));
		},
		function(did, cb) {
			did.assigned = false;
			did.save()
			.then(result => cb())
			.catch(err => cb(err));
		},
		function(cb) {
			Subscriptions.findOne({ branch: params.branchId, customer: params.customerId })
			.then(sub => {
				if(!sub) return cb({ name: 'ENOENT', message: 'subscription not found', params: params });
				return sub.save(); // save subscription to count new amount
			})
			.then(result => cb())
			.catch(err => cb(err));
		}
	], function(err) {
		if(err) return callback(err);
		callback();
	});
}

function createOrder(params, callback) {
	debug('createOrder reqOpts: ', reqOpts);

	didwwRequest('POST', 'orders', params, callback);
}

function deleteOrder(id, callback) {
	debug('createOrder reqOpts: ', reqOpts);

	didwwRequest('DELETE', 'orders/'+id, null, callback);
}

function getDidGroups(params, callback) {
	didwwRequest(
		'GET', 
		'did_groups', 
		null, 
		{
			include: 'country,city,stock_keeping_units',
			filters: [{ key: 'is_available', value: true }, { key: 'country.id', value: params.country }, { key: 'prefix', value: params.areaCode }]
		},
		callback
	);
}

function getDidGroup(id, callback) {
	didwwRequest(
		'GET', 
		'did_groups/'+id, 
		null, 
		{ include: 'stock_keeping_units' },
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

function updateStatus(params, callback) {
	Dids.findOne(params)
	.then(did => {
		if(!did) return callback({ name: 'ENOENT', message: 'did not found', params: params });

		didwwRequest('GET', 'orders/'+did.orderId, function(err, result) {
			if(!result) return callback({ name: 'ENOENT', message: 'order not found', orderId: did.orderId });

			if(result.data.attributes.status !== did.status) {
				did.status = (result.data.attributes.status === 'Completed' ? 'active' : 'pending');
				did.save()
				.then(result => callback(null, result))
				.catch(err => callback(err));
			} else {
				callback(null, did);
			}
		});

	})
	.catch(err => callback(err));
}

function updateRegistration(params, callback) {
	Dids.findOne(params)
	.then(did => {
		if(!did) return callback({ name: 'ENOENT', message: 'did not found', params: params });

		didwwRequest('GET', 'dids/'+did.didId, function(err, result) {
			if(!result) return callback({ name: 'ENOENT', message: 'did not found', didId: did.didId });

			debug('updateRegistration: ', result);

			if(result.data.attributes.awaiting_registration !== did.awaitingRegistration) {
				did.awaitingRegistration = result.data.attributes.awaiting_registration;
				did.save()
				.then(result => callback(null, result))
				.catch(err => callback(err));
			} else {
				callback(null, did);
			}
		});

	})
	.catch(err => callback(err));
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

function updateTrunk(id, params, callback) {
	didwwRequest('PATCH', 'trunks/'+id, params, callback);
}

function deleteTrunk(id, callback) {
	didwwRequest('DELETE', 'trunks/'+id, callback);
}

function didwwRequest(method, path, data, attributes) {
	var lastArg = arguments[arguments.length-1];
	var callback = null;

	if(typeof lastArg === 'function') callback = lastArg;

	reqOpts.method = method;
	reqOpts.url = path;

	if(data && (typeof data !== 'function'))
		reqOpts.body = { data: data };

	if(attributes && (typeof attributes !== 'function')) {
		if(Object.keys(attributes).length) reqOpts.url += '?';

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
		else if(body && body.errors) callback({ name: "DID", message: body.errors[0].title });
		else callback(null, body);
	});		
}

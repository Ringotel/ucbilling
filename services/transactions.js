var Transactions = require('../models/transactions');
var debug = require('debug')('billing');
var async = require('async');
var logger = require('../modules/logger').transactions;

var methods = {

	add: function(params, callback){
		var newTransaction = new Transactions(params);
		var propmise = newTransaction.save();

		if(!callback) return propmise;

		propmise.then(transaction => callback(null, transaction))
		.catch(err => callback(err));
	},
	get: function(query, limit, callback){
		var promise = Transactions.find(query).sort('-createdAt'),
			cb = null;

		if(typeof limit !== 'function') {
			promise.limit(limit);
			cb = callback;
		} else {
			cb = limit;
		}
		promise.exec(function (err, transactions){
			if(err){
				cb(err);
			} else {
				cb(null, transactions);
			}
		});
	},
	update: function(query, data, callback){

		Transactions.update(query, { $set: data }, function(err) {
			if(err) return callback(err);
			callback();
		});
		
	}
	// update: function(query, data, callback){

	// 	async.waterfall([
	// 		function(cb){
	// 			if(typeof query.save === 'function') { // if query is a mongoose document
	// 				cb(null, query);
	// 			} else {
	// 				Transactions.findOne(query, function (err, transaction){
	// 					if(err) return cb(err);
	// 					if(!transactions) return cb('NOT_FOUND');
	// 					cb(null, transaction);
	// 				});
	// 			}
	// 		},
	// 		function(transaction, cb){
	// 			transaction.action = data.action;
	// 			transaction.status = data.status;
	// 			if(data.balance) transaction.balance_after = data.balance;
	// 			transaction.transaction_id = data.transaction_id;
	// 			transaction.service_order_id = data.liqpay_order_id;
	// 			// transaction.ip = data.ip;
	// 			transaction.save(function (err, savedTransaction){
	// 				if(err) {
	// 					//TODO - handle the error
	// 					logger.error(err);
	// 					cb(err);
	// 				} else {
	// 					cb(null, savedTransaction);
	// 					logger.info(savedTransaction.toObject());
	// 				}
	// 			});
	// 		}

	// 	], function(err, transaction){
	// 		if(err) return callback(err);
	// 		callback(null, transaction);
	// 	});
	// }
};

module.exports = methods;
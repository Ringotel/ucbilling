var Transaction = require('../models/transactions');
var debug = require('debug')('billing');
var async = require('async');
var logger = require('../modules/logger').transactions;

var methods = {

	add: function(params, callback){
		var newTransaction = new Transaction(params);
		newTransaction.save(function (err, transaction){
			if(err){
				return callback(err);
			}
			callback(null, transaction);
		});
	},
	get: function(query, limit, callback){
		var promise = Transaction.find(query).sort('-createdAt'),
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
	update: function(params, data, callback){

		async.waterfall([
			function(cb){
				if(typeof params.save === 'function') {
					cb(null, params);
				} else {
					methods.get({ customerId: params.customerId, order_id: params.order_id }, function (err, transactions){
						if(err) {
							//TODO - handle the error
							logger.error(err);
							return cb(err);
						}
						if(!transactions) return cb('Not Found');
						cb(null, transactions[0]);
					});
				}
			},
			function(transaction, cb){
				transaction.action = data.action;
				transaction.status = data.status;
				if(data.balance) transaction.balance = data.balance;
				transaction.transaction_id = data.transaction_id;
				transaction.payment_id = data.payment_id;
				transaction.liqpay_order_id = data.liqpay_order_id;
				transaction.payment_type = data.paytype;
				transaction.err_code = data.err_code;
				transaction.err_description = data.err_description;
				transaction.ip = data.ip;
				transaction.info = data.info;
				transaction.sender_card_mask2 = data.sender_card_mask2;
				transaction.sender_card_bank = data.sender_card_bank;
				transaction.sender_commission = data.sender_commission;
				transaction.sender_card_country = data.sender_card_country;
				transaction.receiver_commission = data.receiver_commission;
				transaction.agent_commission = data.agent_commission;
				transaction.amount_debit = data.amount_debit;
				transaction.amount_credit = data.amount_credit;
				transaction.currency_debit = data.currency_debit;
				transaction.currency_credit = data.currency_credit;
				transaction.commission_debit = data.commission_debit;
				transaction.commission_credit = data.commission_credit;
				transaction.save(function (err, savedTransaction){
					if(err) {
						//TODO - handle the error
						logger.error(err);
						cb(err);
					} else {
						cb(null, savedTransaction);
						logger.info(savedTransaction.toObject());
					}
				});
			}

		], function(err, transaction){
			if(err) return callback(err);
			callback(null, transaction);
		});
		// methods.get({ customerId: params.customerId, order_id: params.order_id }, function (err, transactions){
		// 	if(err) {
		// 		//TODO - handle the error
		// 		logger.error(err);
		// 		callback(err);
		// 	} else {
		// 		var transaction = transactions[0];

		// 		transaction.action = data.action;
		// 		transaction.status = data.status;
		// 		if(data.balance) transaction.balance = data.balance;
		// 		transaction.transaction_id = data.transaction_id;
		// 		transaction.payment_id = data.payment_id;
		// 		transaction.liqpay_order_id = data.liqpay_order_id;
		// 		transaction.payment_type = data.paytype;
		// 		transaction.err_code = data.err_code;
		// 		transaction.err_description = data.err_description;
		// 		transaction.ip = data.ip;
		// 		transaction.info = data.info;
		// 		transaction.sender_card_mask2 = data.sender_card_mask2;
		// 		transaction.sender_card_bank = data.sender_card_bank;
		// 		transaction.sender_commission = data.sender_commission;
		// 		transaction.sender_card_country = data.sender_card_country;
		// 		transaction.receiver_commission = data.receiver_commission;
		// 		transaction.agent_commission = data.agent_commission;
		// 		transaction.amount_debit = data.amount_debit;
		// 		transaction.amount_credit = data.amount_credit;
		// 		transaction.currency_debit = data.currency_debit;
		// 		transaction.currency_credit = data.currency_credit;
		// 		transaction.commission_debit = data.commission_debit;
		// 		transaction.commission_credit = data.commission_credit;
		// 		transaction.save(function (err, savedTransaction){
		// 			if(err) {
		// 				//TODO - handle the error
		// 				logger.error(err);
		// 				callback(err);
		// 			} else {
		// 				callback(null, savedTransaction);
		// 				logger.info(savedTransaction.toObject());
		// 			}
		// 		});
		// 	}
		// });
	}
};

module.exports = methods;
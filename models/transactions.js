var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    amount: String,
    balance: String,
    payment_method: String,
    description: String,
    currency: String,
    order_id: String,
    transaction_id: String,
    payment_id: String,
    payment_type: String,
    liqpay_order_id: String,
    status: { type: String, default: 'pending' },
    err_code: String,
    err_description: String,
    ip: String,
    info: String,
    action: String,
    order: [],
    sender_card_mask2: String,
    sender_card_bank: String,
    sender_card_country: Number,
    sender_commission: Number,
    receiver_commission: Number,
    agent_commission: Number,
    amount_debit: Number,
    amount_credit: Number,
    currency_debit: String,
    currency_credit: String,
    commission_debit: Number,
    commission_credit: Number,
    updatedAt: Number,
    createdAt: Number
}, {collection: 'transactions'});

schema.pre('save', function(next) {
    var transaction = this;
    if(transaction.isNew)
        transaction.createdAt = Date.now();
    
    transaction.updatedAt = Date.now();

    next();
});

module.exports = mongoose.model('Transaction', schema);


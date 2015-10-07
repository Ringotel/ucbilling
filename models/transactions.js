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
    liqpay_order_id: String,
    status: { type: String, default: 'pending' },
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


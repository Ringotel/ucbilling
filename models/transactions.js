var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    serviceStatus: String,
    status: { type: String, default: 'pending' },
    amount: String,
    balance_before: String,
    balance_after: String,
    currency: String,
    description: String,
    payment_method: String,
    payment_service: String,
    payment_type: String,
    order_id: String,
    service_order_id: String,
    transaction_id: String,
    err_code: String,
    err_description: String,
    ip: String,
    action: String,
    order: [],
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


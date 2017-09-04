var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var InvoiceSchema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    description: String,
    currency: String,
    creditUsed: String,
    status: { type: String, default: 'unpaid' },
    items: [],
    updatedAt: Number,
    createdAt: { type: Number, default: Date.now() }
}, {collection: 'invoices'});

InvoiceSchema.pre('save', function(next) {
    discount.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);


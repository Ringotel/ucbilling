var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var InvoiceSchema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    paidAmount: String,
    description: String,
    chargeId: String,
    currency: String,
    creditUsed: String,
    status: { type: String, default: 'unpaid' },
    items: [],
    discounts: [],
    attemptCount: { type: Number, default: 1 },
    maxAttempts: { type: Number, default: 3},
    paymentSource: String,
    updatedAt: Number,
    createdAt: { type: Number, default: Date.now() }
}, {collection: 'invoices'});

InvoiceSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);


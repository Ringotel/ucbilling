var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    amount: String,
	chargeId: String,
    createdAt: Number,
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    currency: String,
    description: String,
    error: {},
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    serviceStatus: String,
    status: String,
    updatedAt: Number
}, {collection: 'charges'});

schema.pre('save', function(next) {
    if(this.isNew) this.createdAt = Date.now();
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Charge', schema);


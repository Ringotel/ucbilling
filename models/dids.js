var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var DidSchema = new Schema({
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    assigned: Boolean,
    awaitingRegistration: Boolean,
    orderId: String,
    didId: String,
    trunkId: String,
    number: String,
    formatted: String,
    country: String,
    prefix: Number,
    areaName: String,
    areaCode: Number,
    type: String,
    price: String,
    restrictions: String,
    included: Boolean,
    status: String,
    currency: String,
    createdAt: Date,
    updatedAt: Date
}, {collection: 'dids'});

DidSchema.pre('save', function(next) {
    if(!this.createdAt){
        this.createdAt = Date.now();
    }

    this.updatedAt = Date.now();
    
    next();

});

module.exports = mongoose.model('Did', DidSchema);


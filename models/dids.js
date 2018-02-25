var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var DidSchema = new Schema({
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    assigned: Boolean,
    awaitingRegistration: Boolean,
    orderId: String,
    didId: String,
    trunkId: String,
    number: String,
    countryPrefix: Number,
    areaCode: Number,
    type: String,
    price: String,
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


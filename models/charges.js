var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    amount: String,
    prevBalance: String,
    balance: String,
    description: String,
    // _branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    _subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    currency: String,
    updatedAt: { type: Number, default: Date.now },
    createdAt: { type: Number, default: Date.now }
}, {collection: 'charges'});

// schema.pre('save', function(next) {
    
// });

module.exports = mongoose.model('Charge', schema);


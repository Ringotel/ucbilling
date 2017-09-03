var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    subId: String,
    amount: String,
    prevBalance: String,
    balance: String,
    description: String,
    currency: String,
    updatedAt: { type: Number, default: Date.now },
    createdAt: { type: Number, default: Date.now }
}, {collection: 'charges'});

// schema.pre('save', function(next) {
    
// });

module.exports = mongoose.model('Charge', schema);


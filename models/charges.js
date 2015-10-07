var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    amount: String,
    prevBalance: String,
    balance: String,
    description: String,
    currency: String,
    createdAt: { type: Number, default: Date.now }
}, {collection: 'charges'});

// schema.pre('save', function(next) {
    
// });

module.exports = mongoose.model('Charge', schema);


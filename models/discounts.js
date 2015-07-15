var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var DiscountSchema = new Schema({
    id: Number,
    name: String,
    decription: String,
    billingCyrcles: Number,
    neverExpires: Boolean,
    amount: String,
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'discounts'});

DiscountSchema.pre('save', function(next) {
    var discount = this;
    if(discount.id){
        discount.updatedAt = Date.now();
        // next();
    } else {
        discount.id = addon.name;
        // next();
    }
    next();
});

module.exports = mongoose.model('Discount', DiscountSchema);


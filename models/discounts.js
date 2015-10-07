var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var DiscountSchema = new Schema({
    // id: Number,
    name: String,
    description: String,
    billingCyrcles: Number,
    neverExpires: Boolean,
    amount: String,
    createdAt: Number,
    updatedAt: Number
}, {collection: 'discounts'});

DiscountSchema.pre('save', function(next) {
    var discount = this;
    if(!discount.createdAt){
        // discount.id = discount.name;
        discount.createdAt = Date.now();
    }

    discount.updatedAt = Date.now();

    next();
});

module.exports = mongoose.model('Discount', DiscountSchema);


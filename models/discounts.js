var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var DiscountSchema = new Schema({
    name: { type: String, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    coupon: {},
    expired: { type: Boolean, default: false },
    createdAt: Number,
    updatedAt: Number
}, {collection: 'discounts'});

DiscountSchema.pre('save', function(next) {
    var discount = this;
    if(!discount.createdAt){
        discount.createdAt = Date.now();
    }

    discount.updatedAt = Date.now();

    next();
});

module.exports = mongoose.model('Discount', DiscountSchema);


var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var CouponSchema = new Schema({
    _state: String,
    name: String,
    description: String,
    amount: String,
    percent: Number,
    expiresAt: Number,
    neverExpires: Boolean,
    createdAt: Number
}, {collection: 'coupons'});

CouponSchema.pre('save', function(next) {
    if(!this.createdAt){
        this.createdAt = Date.now();
    }

    next();
});

module.exports = mongoose.model('Coupon', CouponSchema);


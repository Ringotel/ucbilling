var mongoose = require('mongoose');
// var bcrypt = require('bcrypt');
var Schema = mongoose.Schema;
var AddonsSchema = new Schema({
    id: String,
    name: String,
    decription: String,
    neverExpires: Boolean,
    billingCyrcles: Number,
    currentBillingCyrcle: { type: Number, default: 1 },
    price: String,
    quantity: Number,
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'addons'});

AddonsSchema.pre('save', function(next) {
    var addon = this;
    if(addon.id){
        addon.updatedAt = Date.now();
        // next();
    } else {
        addon.id = addon.name;
        // next();
    }
    next();
});

module.exports = mongoose.model('Addon', AddonsSchema);


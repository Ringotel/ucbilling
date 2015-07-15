var mongoose = require('mongoose');
var utils = require('../lib/utils');
var Addons = require('./addons');
var Schema = mongoose.Schema;
var SubscriptionSchema = new Schema({
    customerId: String,
    branch: {
        oid: String,
        sid: String
    },
    // _branchId: { type: Number, ref: 'Branch' },
    planId: String,
    trialPeriod: Boolean,
    trialExpires: Number,
    billingCyrcles: Number,
    currentBillingCyrcle: { type: Number, default: 1 },
    billingFrequency: Number,
    frequencyUnit: String,
    nextBillingDate: Number,
    nextBillingAmount: String,
    neverExpires: Boolean,
    price: String,
    amount: String,
    balance: { type: String, default: '0' },
    currency: String,
    addOns: [],
    discounts: [],
    state: { type: String, default: 'active' },
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'subscriptions'});

SubscriptionSchema.pre('save', function(next) {
    var sub = this;
        // addOns = [];
    if(sub.id){
        sub.updatedAt = Date.now();
    }

    // if(sub.addOns.length){

    //     sub.addOns.forEach(function(addOn){
    //         Addons.findOne({id: addOn.id}, function(err, result){
    //             if(err){
    //                 next(new Error(err));
    //             } else {
    //                 addOns.push(utils.deepExtend(result, addOn));

    //                 // count subscription amount
    //                 sub.amount += result.price;
    //             }
    //         });
    //         sub.addOns = addOns;
    //         next();
    //     });
    // } else {
        next();
    // }
        
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);


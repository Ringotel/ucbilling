var Big = require('big.js');
var debug = require('debug')('billing');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var SubscriptionSchema = new Schema({
    description: String,
    customerId: String,
    planId: String,
    numId: Number,
    trialPeriod: Boolean,
    trialDuration: Number,
    trialDurationUnit: String,
    trialExpires: Number,
    billingCyrcles: Number,
    currentBillingCyrcle: { type: Number, default: 1 },
    billingPeriod: Number,
    billingPeriodUnit: String,
    nextBillingAmount: String,
    nextBillingDate: Number,
    lastBillingDate: Number,
    prevBillingDate: Number,
    expiredSince: Number,
    neverExpires: Boolean,
    price: String,
    amount: String,
    quantity: { type: Number, default: 1 },
    currency: String,
    creditLimit: String,
    addOns: [],
    discounts: [],
    _branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    state: { type: String, default: 'active' },
    createdAt: Number,
    updatedAt: Number
}, {collection: 'subscriptions'});

Big.RM = 0;

SubscriptionSchema.methods.countAmount = function(cb){

    var amount = 0;
    amount += parseFloat(this.price) * this.quantity;

    if(this.addOns && this.addOns.length){
        this.addOns.forEach(function (item){
            amount += parseFloat(item.price) * item.quantity;
        });
    }

    if(cb) cb(amount);
    else return amount;
};

SubscriptionSchema.methods.countNextBillingAmount = function(amount, cb){
    var sub = this, nextBillingAmount;
    if(amount > 0)
        nextBillingAmount = Big(amount).div(sub.billingCyrcles).toFixed(4).toString();
    else
        nextBillingAmount = 0;

    if(cb) cb(nextBillingAmount);
    else return nextBillingAmount;
};

SubscriptionSchema.pre('save', function(next) {
    var sub = this, amount;

    if(!sub.createdAt){
        sub.createdAt = Date.now();
    }

    //count subscription amount and nextBillingAmount
    amount = sub.countAmount();
    debug('subscription amount: %s', amount);
    sub.nextBillingAmount = sub.countNextBillingAmount(amount);
    // if(amount > 0)
    //     sub.nextBillingAmount = Big(amount).div(sub.billingCyrcles).toFixed(4).toString();
    // else
    //     sub.nextBillingAmount = 0;

    sub.amount = amount.toString();

    sub.updatedAt = Date.now();
    next();
        
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);


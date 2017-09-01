var debug = require('debug')('billing');
var mongoose = require('mongoose');
var Big = require('big.js');
var StringMaxLength = 450;
var Schema = mongoose.Schema;
var SubscriptionSchema = new Schema({
    addOns: [],
    amount: String,
    billingCycles: Number,
    billingPeriod: Number,
    billingPeriodUnit: String,
    _branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    chargeTries: { type: Number, default: 0 },
    maxChargeTries: { type: Number, default: 3 },
    currency: String,
    currentBillingCycle: { type: Number, default: 0 },
    customerId: String,
    description: { type: String, maxlength: StringMaxLength },
    planId: String,
    numId: Number,
    trialPeriod: Boolean,
    trialDuration: Number,
    trialDurationUnit: String,
    trialExpires: Number,
    nextBillingAmount: String,
    nextBillingDate: Number,
    lastBillingDate: Number,
    prevBillingDate: Number,
    expiredSince: Number,
    neverExpires: Boolean,
    plan: {},
    price: String,
    quantity: { type: Number, default: 1 },
    creditLimit: String,
    discounts: [],
    state: { type: String, default: 'active' },
    createdAt: Number,
    updatedAt: Number
}, {collection: 'subscriptions'});

SubscriptionSchema.methods.countAmount = function(cb){

    var amount = Big(this.price).times(this.quantity);

    if(this.addOns && this.addOns.length){
        this.addOns.forEach(function (item){
            if(item.quantity) amount = amount.plus(Big(item.price).times(item.quantity));
        });
    }

    if(cb) cb(amount.valueOf());
    else return amount.valueOf();
};

SubscriptionSchema.methods.countNextBillingAmount = function(amount, cb){
    var sub = this, nextBillingAmount;
    if(amount > 0)
        nextBillingAmount = Big(amount).div(sub.billingCycles).toFixed(2);
    else
        nextBillingAmount = Big(0);

    if(cb) cb(nextBillingAmount.valueOf());
    else return nextBillingAmount.valueOf();
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
    sub.amount = amount;

    sub.updatedAt = Date.now();
    next();
        
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);


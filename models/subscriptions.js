var Big = require('big.js');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var SubscriptionSchema = new Schema({
    customerId: String,
    planId: String,
    trialPeriod: Boolean,
    trialDuration: Number,
    trialDurationUnit: String,
    trialExpires: Number,
    billingCyrcles: Number,
    currentBillingCyrcle: { type: Number, default: 1 },
    billingPeriod: Number,
    billingPeriodUnit: String,
    nextBillingDate: Number,
    nextBillingAmount: String,
    neverExpires: Boolean,
    price: String,
    amount: String,
    quantity: Number,
    balance: String,
    currency: String,
    creditLimit: String,
    addOns: [],
    discounts: [],
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

SubscriptionSchema.pre('save', function(next) {
    var sub = this, amount;

    if(!sub.createdAt){
        sub.createdAt = Date.now();
    }

    //count subscription amount and nextBillingAmount
    amount = sub.countAmount();
    sub.nextBillingAmount = Big(amount).div(sub.billingCyrcles).toFixed(4).toString();
    sub.amount = amount.toString();

    sub.updatedAt = Date.now();
    next();
        
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);


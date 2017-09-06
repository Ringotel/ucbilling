var debug = require('debug')('billing');
var mongoose = require('mongoose');
var Big = require('big.js');
var StringMaxLength = 450;
var Schema = mongoose.Schema;
var SubscriptionSchema = new Schema({
    addOns: [],
    amount: String,
    branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    currency: String,
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    description: { type: String, maxlength: StringMaxLength },
    nextBillingDate: Number,
    prevBillingDate: Number,
    pastDueSince: Number,
    neverExpires: Boolean,
    plan: {},
    price: String,
    quantity: { type: Number, default: 1 },
    state: { type: String, default: 'active' },
    createdAt: Number,
    updatedAt: Number
    // planId: String,
    // numId: Number,
    // nextBillingAmount: String,
    // lastBillingDate: Number,
    // creditLimit: String,
    // discounts: [],
    // billingCycles: Number,
    // chargeTries: { type: Number, default: 0 },
    // maxChargeTries: { type: Number, default: 3 },
    // currentBillingCycle: { type: Number, default: 0 },
}, {collection: 'subscriptions'});

SubscriptionSchema.methods.countAmount = function(){

    var price = this.price || this.plan.price;
    var amount = Big(price).times(this.quantity);

    if(this.addOns && this.addOns.length){
        this.addOns.forEach(function (item){
            if(item.quantity) amount = amount.plus(Big(item.price).times(item.quantity));
        });
    }

    return amount.toFixed(2).valueOf();
};

SubscriptionSchema.methods.countNextBillingAmount = function(){
    let sub = this, 
    billingCycles = sub.billingCycles - sub.currentBillingCycle,
    subAmount = Big(sub.amount),
    nextBillingAmount = Big(0);

    if(subAmount.gt(0))
        nextBillingAmount = subAmount.div(billingCycles).toFixed(2);

    return nextBillingAmount.valueOf();
};

SubscriptionSchema.pre('save', function(next) {
    var sub = this, amount;

    if(!sub.createdAt){
        sub.createdAt = Date.now();
    }

    //count subscription amount and nextBillingAmount
    amount = sub.countAmount();
    debug('subscription amount: %s', amount);
    // sub.nextBillingAmount = sub.countNextBillingAmount(amount);
    sub.amount = amount;

    sub.updatedAt = Date.now();
    next();
        
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);


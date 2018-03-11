var debug = require('debug')('billing');
var mongoose = require('mongoose');
var Big = require('big.js');
var Dids = require('./dids');
var StringMaxLength = 450;
var Schema = mongoose.Schema;

var AddOn = new Schema({
    // updatedAt: Number,
    // createdAt: Number,
    name: String,
    description: String,
    price: String,
    // currency: String,
    // neverExpires: Boolean,
    quantity: Number
});

var SubscriptionSchema = new Schema({
    addOns: [AddOn],
    amount: String,
    branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    currency: String,
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    description: { type: String, maxlength: StringMaxLength },
    nextBillingDate: Number,
    prevBillingDate: Number,
    trialExpires: Number,
    pastDueSince: Number,
    neverExpires: Boolean,
    plan: {},
    price: String,
    quantity: { type: Number, default: 1 },
    hasDids: Boolean,
    status: { type: String, default: 'active' },
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

    return new Promise((resolve, reject) => {

        var price = this.price || this.plan.price;
        var amount = Big(price).times(this.quantity);

        if(this.addOns && this.addOns.length){
            this.addOns.forEach(function (item){
                if(item.quantity) amount = amount.plus(Big(item.price).times(item.quantity));
            });
        }

        if(this.hasDids) {
            Dids.find({ branch: this.branch, assigned: true, included: false }, 'price')
            .then(result => {
                if(result && result.length) {
                    result.forEach(item => { amount = amount.plus(item.price) });
                }

                resolve(amount.toFixed(2));
            })
            .catch(err => reject(err));

        } else {
            resolve(amount.toFixed(2));
        }            
            

    });
};

// SubscriptionSchema.methods.countAmount = function(){

//     var price = this.price || this.plan.price;
//     var amount = Big(price).times(this.quantity);

//     if(this.addOns && this.addOns.length){
//         this.addOns.forEach(function (item){
//             if(item.quantity) amount = amount.plus(Big(item.price).times(item.quantity));
//         });
//     }

//     return amount.toFixed(2).valueOf();
// };

// SubscriptionSchema.methods.countNextBillingAmount = function(){
//     let sub = this, 
//     billingCycles = sub.billingCycles - sub.currentBillingCycle,
//     subAmount = Big(sub.amount),
//     nextBillingAmount = Big(0);

//     if(subAmount.gt(0))
//         nextBillingAmount = subAmount.div(billingCycles).toFixed(2);

//     return nextBillingAmount.valueOf();
// };

SubscriptionSchema.pre('save', function(next) {
    var sub = this, amount;

    if(!sub.createdAt){
        sub.createdAt = Date.now();
    }

    //count subscription amount and nextBillingAmount
    sub.countAmount()
    .then(newAmount => {
        sub.amount = newAmount;
        sub.updatedAt = Date.now();

        debug('subscription amount: %s', newAmount);

        next();
    })
    .catch(err => next());
        
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);


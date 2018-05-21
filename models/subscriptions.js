var debug = require('debug')('billing');
var mongoose = require('mongoose');
var Big = require('big.js');
var Dids = require('./dids');
var StringMaxLength = 450;
var Schema = mongoose.Schema;

var AddOn = new Schema({
    name: String,
    description: String,
    price: String,
    quantity: Number
});

var PlanSchema = new Schema({
    planId: String,
    numId: Number,
    name: String,
    description: String,
    trialPeriod: { type: Boolean, default: false },
    trialDuration: Number,
    trialDurationUnit: String,
    billingPeriod: Number,
    billingPeriodUnit: String,
    neverExpires: { type: Boolean, default: false },
    price: String,
    currency: String,
    creditLimit: { type: String, default: '0' },
    addOns: [],
    attributes: {},
    createdAt: Number,
    updatedAt: Number
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
    plan: PlanSchema,
    price: String,
    quantity: { type: Number, default: 1 },
    hasDids: Boolean,
    state: String,
    status: { type: String, default: 'active' },
    createdAt: Number,
    updatedAt: Number
}, {collection: 'subscriptions'});

SubscriptionSchema.methods.countAmount = function(){

    return new Promise((resolve, reject) => {

        var price = this.price || this.plan.price;
        var amount = Big(price).times(this.quantity);
        var priceProp = this.plan.billingPeriodUnit === 'years' ? 'annualPrice' : 'monthlyPrice';

        if(this.addOns && this.addOns.length){
            this.addOns.forEach(function (item){
                if(item.quantity) amount = amount.plus(Big(item.price).times(item.quantity));
            });
        }

        if(this.hasDids) {
            Dids.find({ branch: this.branch, assigned: true, included: false }, priceProp)
            .then(result => {
                if(result && result.length) {
                    result.forEach(item => { 
                        amount = amount.plus(item[priceProp]) 
                    });
                }

                resolve(amount.toFixed(2));
            })
            .catch(err => reject(err));

        } else {
            resolve(amount.toFixed(2));
        }            
            

    });
};

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


var mongoose = require('mongoose');
// var bcrypt = require('bcrypt');
var Schema = mongoose.Schema;
var PlanSchema = new Schema({
    id: String,
    name: String,
    description: String,
    trialPeriod: { type: Boolean, default: false },
    trialDuration: Number,
    trialDurationUnit: String,
    billingCyrcles: Number,
    billingFrequency: Number,
    frequencyUnit: String,
    neverExpires: Boolean,
    price: String,
    currency: String,
    addOns: [],
    discounts: [],
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'plans'});

PlanSchema.pre('save', function(next) {
    var plan = this;
    if(plan.id){
        plan.updatedAt = Date.now();
        next();
    } else {
        plan.id = plan.name;
        next();
    }
});

module.exports = mongoose.model('Plan', PlanSchema);


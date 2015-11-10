var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var PlanSchema = new Schema({
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
    discounts: [],
    customData: {},
    createdAt: Number,
    updatedAt: Number
}, {collection: 'plans'});

PlanSchema.pre('save', function(next) {
    var plan = this;
    if(!plan.createdAt){
        // plan.id = plan.name;
        plan.createdAt = Date.now();
    }

    plan.updatedAt = Date.now();
    
    next();

});

module.exports = mongoose.model('Plan', PlanSchema);


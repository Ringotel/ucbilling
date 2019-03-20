var mongoose = require('mongoose');
var bcrypt = require('../services/bcrypt');
var StringMaxLength = 450;
var Schema = mongoose.Schema;

var billingMethod = new Schema({
    method: String,
    service: String,
    default: Boolean,
    serviceCustomer: String,
    params: {}
});

var CustomerSchema = new Schema({
    email: { type: String, unique: true },
    emailDomain: { type: String},
    name: { type: String, maxlength: StringMaxLength },
    login: { type: String, maxlength: StringMaxLength },
    password: { type: String, maxlength: StringMaxLength },
    lang: { type: String, default: 'en' },
    domain: String,
    // country: { type: String, maxlength: StringMaxLength },
    company: { type: String, maxlength: StringMaxLength },
    // website: { type: String, maxlength: StringMaxLength },
    billingMethod: billingMethod,
    billingDetails: [billingMethod],
    discounts: [],
    pastDueDate: Number,
    role: String,
    superAdmin: Boolean,
    balance: {type: String, default: '0' },
    creditLimit: {type: String, default: '0'},
    state: { type: String, default: 'active' },
    stateDescription: String,
    activated: { type: Boolean, default: false },
    currency: String,
    vatNumber: String,
    lastLogin: Number,
    token: String,
    partner: { type: Schema.Types.ObjectId, ref: 'Partner' },
    updatedAt: Number,
    createdAt: { type: Number, default: Date.now }
}, {collection: 'customers'});

CustomerSchema.pre('save', function(next) {
    var customer = this;
    customer.updatedAt = Date.now();

    console.log('customer isNew: ', customer.isNew);
    console.log('customer new pass: ', customer.isModified('password'));

    //only hash the password if it has been modified (or is new)
    if (customer.password && (customer.isNew || customer.isModified('password'))){
        bcrypt.hash(customer.password, function(err, hash) {
            if (err) return next(new Error(err));
            // override the cleartext password with the hashed one
            customer.password = hash;
            next();
        });
    } else {
        next();
    }
});

module.exports = mongoose.model('Customer', CustomerSchema);


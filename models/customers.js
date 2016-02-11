var mongoose = require('mongoose');
var bcrypt = require('../services/bcrypt');
var Schema = mongoose.Schema;
var CustomerSchema = new Schema({
    email: { type: String, unique: true },
    name: String,
    password: String,
    lang: { type: String, default: 'en' },
    phone: String,
    country: String,
    website: String,
    pastDueDate: Number,
    role: { type: String, default: 'user' },
    balance: {type: String, default: '0' },
    creditLimit: {type: String, default: '0'},
    state: { type: String, default: 'active' },
    stateDescription: String,
    currency: String,
    updatedAt: Number,
    createdAt: { type: Number, default: Date.now }
}, {collection: 'customers'});

CustomerSchema.pre('save', function(next) {
    var customer = this;
    customer.updatedAt = Date.now();

    console.log('customer isNew: ', customer.isNew);
    //only hash the password if it has been modified (or is new)
    if (customer.isNew || !customer.isModified('password')){
        // customer.createdAt = Date.now();
        next();
    } else {
        bcrypt.hash(customer.password, function(err, hash) {
            if (err) return next(new Error(err));
            // override the cleartext password with the hashed one
            customer.password = hash;
            next();
        });
        // bcrypt.genSalt(10, function(err, salt) {
        //     if (err) throw err;

        //     // hash the password using our new salt
        //     bcrypt.hash(customer.password, salt, function(err, hash) {
        //         if (err) throw err;
        //         // override the cleartext password with the hashed one
        //         customer.password = hash;
        //         next();
        //     });
        // });
    }
});

module.exports = mongoose.model('Customer', CustomerSchema);


var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var Schema = mongoose.Schema;
var CustomerSchema = new Schema({
    id: String,
    email: String,
    name: String,
    password: String,
    phone: String,
    country: String,
    website: String,
    pastDueDate: Number,
    role: { type: String, default: 'user' },
    state: { type: String, default: 'active' },
    balance: {type: String, default: '0.00' },
    createdAt: { type: Number, default: Date.now },
    updatedAt: {type: Number, default: Date.now }
}, {collection: 'customers'});

CustomerSchema.pre('save', function(next) {
    var customer = this;

    if(customer.id)
        customer.updateAt = Date.now();

    // only hash the password if it has been modified (or is new)
    if (!customer.isModified('password')) return next();

    bcrypt.genSalt(10, function(err, salt) {
        if (err) throw err;

        // hash the password using our new salt
        bcrypt.hash(customer.password, salt, function(err, hash) {
            if (err) throw err;
            // override the cleartext password with the hashed one
            customer.password = hash;
            next();
        });
    });
});

module.exports = mongoose.model('Customer', CustomerSchema);


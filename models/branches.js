var mongoose = require('mongoose');
var bcrypt = require('../services/bcrypt');
var debug = require('debug')('billing');
var StringMaxLength = 450;
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    oid: String,
    sid: String,
    login: { type: String, maxlength: StringMaxLength },
    password: { type: String, maxlength: StringMaxLength }, 
    name: { type: String, maxlength: StringMaxLength },
    admin: { type: String, maxlength: StringMaxLength },
    adminEmail: { type: String, maxlength: StringMaxLength },
    prefix: { type: String, maxlength: StringMaxLength },
    _subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    lastLogin: Number,
    createdAt: { type: Number, default: Date.now }
}, {collection: 'branches'});

schema.pre('save', function(next) {

    var branch = this;

    //only hash the password if it has been modified (or is new)
    if (branch.password && (branch.isNew || branch.isModified('password'))){
                
        bcrypt.hash(branch.password, function(err, hash) {
            if (err) return next(new Error(err));
            
            debug('Branches presave hash: ', branch.password, hash);

            // override the cleartext password with the hashed one
            branch.password = hash;
            next();
        });
    } else {
        next();
    }

});

module.exports = mongoose.model('Branch', schema);


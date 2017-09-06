var mongoose = require('mongoose');
var bcrypt = require('../services/bcrypt');
var debug = require('debug')('billing');
var StringMaxLength = 450;
var Schema = mongoose.Schema;
var schema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    oid: String,
    sid: String,
    adminname: { type: String, maxlength: StringMaxLength },
    adminpass: { type: String, maxlength: StringMaxLength }, 
    admin: {
        name: { type: String, maxlength: StringMaxLength },
        email: { type: String, maxlength: StringMaxLength }
    },
    name: { type: String, maxlength: StringMaxLength },
    prefix: { type: String, maxlength: StringMaxLength },
    timezone: { type: String, maxlength: StringMaxLength },
    lang: { type: String, maxlength: StringMaxLength },
    lastLogin: Number,
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'branches'});

schema.pre('save', function(next) {

    var branch = this;
    branch.updatedAt = Date.now();

    //only hash the password if it has been modified (or is new)
    if (branch.adminpass && (branch.isNew || branch.isModified('adminpass'))){
                
        bcrypt.hash(branch.adminpass, function(err, hash) {
            if (err) return next(new Error(err));
            
            debug('Branches presave hash: ', branch.adminpass, hash);

            // override the cleartext password with the hashed one
            branch.adminpass = hash;
            next();
        });
    } else {
        next();
    }

});

module.exports = mongoose.model('Branch', schema);


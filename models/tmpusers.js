var mongoose = require('mongoose');
var bcrypt = require('../services/bcrypt');
var shortid = require('shortid');
var StringMaxLength = 450;
var Schema = mongoose.Schema;
var schema = new Schema({
    email: { type: String, unique: true, maxlength: StringMaxLength },
    name: { type: String, maxlength: StringMaxLength },
    login: { type: String, maxlength: StringMaxLength },
    password: { type: String, maxlength: StringMaxLength },
    lang: { type: String, default: 'en' },
    currency: String,
    phone: { type: String, maxlength: 15 },
    country: { type: String, maxlength: StringMaxLength },
    company: { type: String, maxlength: StringMaxLength },
    website: { type: String, maxlength: StringMaxLength },
    domain: { type: String, maxlength: StringMaxLength },
    server: { type: String, maxlength: StringMaxLength },
    token: String,
    createdAt: { type: Date, expires: '24h' }
}, {collection: 'tmpusers'});

// schema.pre('save', function (next){

//     var tmpUser = this;
//     bcrypt.hash(tmpUser.password, function(err, hash) {
//         if (err) return next(new Error(err));
//         // override the cleartext password with the hashed one
//         tmpUser.password = hash;
//         return next();
//     });

//     next();

// });

module.exports = mongoose.model('tmpusers', schema);
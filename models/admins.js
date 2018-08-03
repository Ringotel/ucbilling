var mongoose = require('mongoose');
var bcrypt = require('../services/bcrypt');
var Schema = mongoose.Schema;
var AdminSchema = new Schema({
    // id: String,
    login: String,
    email: String,
    name: String,
    password: String,
    phone: String,
    role: { type: String, default: 'admin' },
    state: { type: String, default: 'active' },
    createdAt: Number,
    updatedAt: Number
}, {collection: 'admins'});

AdminSchema.pre('save', function(next) {
    var user = this;

    if(!user.createdAt){
        // user.id = Date.now();
        user.createdAt = Date.now();
    }
    
    user.updateAt = Date.now();

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next();

    bcrypt.hash(user.password, function(err, hash) {
        if(err) return next(new Error(err));
        user.password = hash;
        next();
    });
});

module.exports = mongoose.model('Admin', AdminSchema);


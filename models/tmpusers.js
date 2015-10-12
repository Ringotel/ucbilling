var mongoose = require('mongoose');
var shortid = require('shortid');
var Schema = mongoose.Schema;
var schema = new Schema({
    email: String,
    name: String,
    password: String,
    lang: { type: String, default: 'en' },
    currency: String,
    phone: String,
    country: String,
    website: String,
    token: { type: String, unique: true },
    createdAt: { type: Date, expires: '24h', default: Date.now }
}, {collection: 'tmpusers'});

schema.pre('save', function (next){

    this.token = shortid.generate();

    next();

});

module.exports = mongoose.model('tmpusers', schema);


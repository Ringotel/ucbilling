var mongoose = require('mongoose');
var encrypt = require('../services/encrypt').encrypt;
var Schema = mongoose.Schema;
var ServerSchema = new Schema({
    state: { type: String, default: '0' },
    name: String,
    url: String,
    login: String,
    password: String,
    domain: String,
    ca: String,
    createdAt: Number,
    updatedAt: Number
}, {collection: 'servers'});

ServerSchema.pre('save', function(next) {
    var server = this;
    if(!server.createdAt){
        server.createdAt = Date.now();
    }

    if(server.isModified('password')) {
        server.password = encrypt(server.password);
    }

    server.updatedAt = Date.now();

    next();
});

module.exports = mongoose.model('Server', ServerSchema);


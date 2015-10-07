var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ServerSchema = new Schema({
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

    server.updatedAt = Date.now();

    next();
});

module.exports = mongoose.model('Server', ServerSchema);


var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ServerSchema = new Schema({
    id: String,
    url: String,
    login: String,
    password: String,
    ca: String,
    domain: String,
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'servers'});

ServerSchema.pre('save', function(next) {
    var server = this;
    if(server.id){
        server.updatedAt = Date.now();
        next();
    } else {
        next();
    }
});

module.exports = mongoose.model('Server', ServerSchema);


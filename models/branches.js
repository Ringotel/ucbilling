var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var schema = new Schema({
    customerId: String,
    oid: String,
    sid: String,
    name: String,
    prefix: String,
    _subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    createdAt: Number
}, {collection: 'branches'});

schema.pre('save', function(next) {
    var server = this;
    if(!server.createdAt){
        server.createdAt = Date.now();
    }
    next();
});

module.exports = mongoose.model('Branch', schema);


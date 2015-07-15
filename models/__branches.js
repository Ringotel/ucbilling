var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var BranchSchema = new Schema({
    oid: String,
    sid: String,
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now }
}, {collection: 'branches'});

BranchSchema.pre('save', function(next) {
    var branch = this;
    if(branch.id){
        branch.updatedAt = Date.now();
        next();
    } else {
        next();
    }
});

module.exports = mongoose.model('Branch', BranchSchema);


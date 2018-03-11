var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var DidsPriceSchema = new Schema({
    country: String,
    city: String,
    type: String,
    prefix: String,
    areaCode: String,
    areaName: String,
    setupFee: Number,
    monthlyPrice: Number,
    annualPrice: Number,
    restrictions: String
}, {collection: 'dids_pricelist'});

module.exports = mongoose.model('DidsPrice', DidsPriceSchema);


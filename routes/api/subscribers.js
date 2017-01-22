var express = require('express');
var router = express.Router();
var sublistCtrl = require('../../controllers/sublist');

module.exports = router;

/*** Subscribers List Routes ***/
router.post('/sublist/add', sublistCtrl);
var express = require('express');
var router = express.Router();
var checkoutCtrl = require('../controllers/checkout');
var issuesCtrl = require('../controllers/issues');
var debug = require('debug')('billing');

module.exports = router;

/****************************************
*			Unauthorized zone				*
*****************************************/

/*** Checkout Result Routes ***/
router.post('/checkoutResult', checkoutCtrl.checkoutResult);

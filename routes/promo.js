var express = require('express');
var router = express.Router();
var promoCtrl = require('../controllers/promo');

router.post('/signup', promoCtrl.promoSignUp);
router.post('/subscription/create', promoCtrl.createPromoSubscription);

module.exports = router;
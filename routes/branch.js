var express = require('express');
var router = express.Router();
var authCtrl = require('../controllers/auth-branch');
var customersCtrl = require('../controllers/customers');
var subsCtrl = require('../controllers/subscriptions');
var branchesCtrl = require('../controllers/branches');
var subsCtrl = require('../controllers/subscriptions');
var plansCtrl = require('../controllers/plans');
var invoicesCtrl = require('../controllers/invoices');
var checkoutCtrl = require('../controllers/checkout');
var discountsCtrl = require('../controllers/discounts');
// var numbersCtrl = require('../controllers/numbers');
var validateRequest = require('../middlewares/validateRequest');
var debug = require('debug')('billing');

module.exports = router;

/*** Authorization Routes ***/
router.post('/signup', authCtrl.signup);
router.post('/verify', authCtrl.verify);
router.post('/authorize', authCtrl.authorize);

/*** Validation Middleware. Don't move it!!! ***/
router.use(validateRequest);

/****************************************
*			Authorized zone				*
*****************************************/

router.use(function (req, res, next){
	req.body.customerId = req.decoded.customerId;
	req.body.branchId = req.decoded.branchId;
	next();
});

// router.post('/numbers/getCountries', numbersCtrl.getCountries);
// router.post('/numbers/buyDids', numbersCtrl.buyDids);

router.post('/getProfile', customersCtrl.get);
router.post('/addCard', customersCtrl.addCard);
router.post('/updateCard', customersCtrl.updateCard);
router.post('/updateBalance', customersCtrl.updateBalance);

router.post('/addCoupon', discountsCtrl.add);
router.post('/getDiscounts', discountsCtrl.get);

router.post('/changePassword', branchesCtrl.changePassword);
router.post('/deleteBranch', branchesCtrl.deleteBranch);

router.post('/getPlans', plansCtrl.getPlans);

router.post('/getInvoices', invoicesCtrl.get);

router.post('/createSubscription', subsCtrl.create);
router.post('/getSubscription', subsCtrl.get);
router.post('/updateSubscription', subsCtrl.update);
router.post('/renewSubscription', subsCtrl.renew);
router.post('/changePlan', subsCtrl.changePlan);

router.post('/checkout', checkoutCtrl.checkout);


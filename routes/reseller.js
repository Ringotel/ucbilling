var express = require('express');
var router = express.Router();
var customersCtrl = require('../controllers/customers');
var transactionsCtrl = require('../controllers/transactions');
var chargesCtrl = require('../controllers/charges');
var plansCtrl = require('../controllers/plans');
var serversCtrl = require('../controllers/servers');
var branchesCtrl = require('../controllers/branches');
var subsCtrl = require('../controllers/subscriptions');
var authCtrl = require('../controllers/auth');
var checkoutCtrl = require('../controllers/checkout');
var startCtrl = require('../controllers/start');
// var apiCtrl = require('../../controllers/api');
var validateRequest = require('../middlewares/validateRequest');

module.exports = router;

/****************************************
*			Unauthorized zone				*
*****************************************/

/*** Authorization Routes ***/
router.post('/authorize', authCtrl.authorize);
router.post('/login', authCtrl.login);
router.post('/signup', authCtrl.signup);
router.post('/requestPasswordReset', authCtrl.requestPasswordReset);
router.post('/resetPassword', authCtrl.resetPassword);
router.get('/verify-email/*', authCtrl.verify);

/*** Validation Middleware. Don't move it!!! ***/
router.use(validateRequest);

/****************************************
*			Authorized zone				*
*****************************************/

router.get('/loggedin', authCtrl.loggedin);

router.use(function (req, res, next){
	req.body.customerId = req.decoded._id;
	next();
});

/*** Customers Routes ***/
router.post('/getCustomer', customersCtrl.get);
router.post('/update', customersCtrl.update);
router.post('/remove', customersCtrl.remove);
router.post('/getCustomerBalance', customersCtrl.getCustomerBalance);
router.post('/setCustomerLang', customersCtrl.setCustomerLang);

/*** Transactions Routes ***/
router.post('/transactions', transactionsCtrl.get);

/*** Charges Routes ***/
router.post('/charges', chargesCtrl.get);

/*** Servers Routes ***/
router.post('/getServers', serversCtrl.getServers);

/*** Plans Routes ***/
router.post('/getPlans', plansCtrl.getPlans);

/*** Branches Routes ***/
router.post('/getBranch/:oid', branchesCtrl.getBranch);
router.post('/getBranches', branchesCtrl.getBranches);
router.post('/updateBranch/:oid', branchesCtrl.updateBranch);
router.post('/deleteBranch', branchesCtrl.deleteBranch);
router.post('/isPrefixValid', branchesCtrl.isPrefixValid);
router.post('/isNameValid', branchesCtrl.isNameValid);
// router.post('/activateBranch', branchesCtrl.activateBranch);
// router.post('/pauseBranch', branchesCtrl.pauseBranch);

/*** Subscriptions Routes ***/
router.post('/canCreateTrialSub', subsCtrl.canCreateTrialSub);
router.post('/createSubscription', subsCtrl.create);
router.post('/updateSubscription', subsCtrl.update);
router.post('/changePlan', subsCtrl.changePlan);
router.post('/renewSubscription', subsCtrl.renew);
router.post('/getSubscriptionAmount', subsCtrl.getSubscriptionAmount);

/*** Checkout Routes ***/
router.post('/checkout', checkoutCtrl.checkout);
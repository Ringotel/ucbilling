var express = require('express');
var router = express.Router();
var authCtrl = require('../controllers/auth-branch');
var customersCtrl = require('../controllers/customers');
var subsCtrl = require('../controllers/subscriptions');
var branchesCtrl = require('../controllers/branches');
var subsCtrl = require('../controllers/subscriptions');
var plansCtrl = require('../controllers/plans');
var invoicesCtrl = require('../controllers/invoices');
var discountsCtrl = require('../controllers/discounts');
var didCtrl = require('../controllers/dids');
var validateRequest = require('../middlewares/validateRequest');
var debug = require('debug')('billing');

module.exports = router;

/****************************************
*			Unauthorized zone			*
*****************************************/
/*** Authorization Routes ***/
router.post('/signup', authCtrl.signup);
router.post('/verify', authCtrl.verify);
router.post('/authorize', authCtrl.authorize);
router.post('/requestResetPassword', authCtrl.requestResetPassword);

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

/****************************************
*			Customers					*
*****************************************/
router.post('/getProfile', customersCtrl.get);
router.post('/addCard', customersCtrl.addCard);
router.post('/updateCard', customersCtrl.updateCard);
router.post('/updateBalance', customersCtrl.updateBalance);

/****************************************
*			Discounts					*
*****************************************/
router.post('/addCoupon', discountsCtrl.add);
router.post('/getDiscounts', discountsCtrl.get);

/****************************************
*			Branches					*
*****************************************/
router.post('/changeAdminEmail', branchesCtrl.changeAdminEmail);
router.post('/deleteBranch', branchesCtrl.deleteBranch);


/****************************************
*			Plans						*
*****************************************/
router.post('/getPlans', plansCtrl.getPlans);

/****************************************
*			Invoices					*
*****************************************/
router.post('/getInvoices', invoicesCtrl.get);

/****************************************
*			Subscriptions				*
*****************************************/
// router.post('/createSubscription', subsCtrl.create);
router.post('/getSubscription', subsCtrl.get);
router.post('/getSubscriptionAmount', subsCtrl.getAmount);
router.post('/updateSubscription', subsCtrl.update);
router.post('/renewSubscription', subsCtrl.renew);
router.post('/changePlan', subsCtrl.changePlan);

/****************************************
*			DID Numbers					*
*****************************************/
router.post('/getDid', didCtrl.getDid);
router.post('/hasDids', didCtrl.hasDids);
router.post('/getAssignedDids', didCtrl.getAssignedDids);
router.post('/getDidCountries', didCtrl.getCountries);
router.post('/getDidLocations', didCtrl.getLocations);
router.post('/getDidPrice', didCtrl.getDidPrice);
router.post('/orderDid', didCtrl.orderDid);
router.post('/updateDidStatus', didCtrl.updateStatus);
router.post('/updateDidRegistration', didCtrl.updateRegistration);
router.post('/unassignDid', didCtrl.unassignDid);
router.post('/getCredits', didCtrl.getCallingCredits);
router.post('/addCredits', didCtrl.addCallingCredits);


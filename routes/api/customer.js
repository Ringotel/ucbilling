var express = require('express');
var router = express.Router();
var customersCtrl = require('../../controllers/customers');
var transactionsCtrl = require('../../controllers/transactions');
var chargesCtrl = require('../../controllers/charges');
var authCtrl = require('../../controllers/auth');
var apiCtrl = require('../../controllers/api');
var validateRequest = require('../../middlewares/validateRequest');

router.post('/login', authCtrl.login);
router.post('/signup', authCtrl.signup);

router.post('/requestPasswordReset', authCtrl.requestPasswordReset);
router.post('/resetPassword', authCtrl.resetPassword);

router.post('/checkoutResult', apiCtrl.checkoutResult);

router.get('/verify-email/*', authCtrl.verify);
// router.get('/verify', authCtrl.verify);

router.use(validateRequest);

router.get('/loggedin', authCtrl.loggedin);
router.use(function (req, res, next){
	req.body.customerId = req.decoded._id;
	next();
});

router.post('/create', customersCtrl.create);
router.post('/update/:id', customersCtrl.update);
router.post('/get/:id', customersCtrl.get);
router.post('/delete/:id', customersCtrl.deleteIt);
router.post('/getCustomerBalance', customersCtrl.getCustomerBalance);
router.post('/setCustomerLang', customersCtrl.setCustomerLang);

router.post('/transactions', transactionsCtrl.get);
router.post('/charges', chargesCtrl.get);

router.post('/getBranch/:oid', apiCtrl.getBranch);
router.post('/getBranches', apiCtrl.getBranches);
// router.post('/createBranch', apiCtrl.createBranch);
router.post('/updateBranch/:oid', apiCtrl.updateBranch);

router.post('/getServers', apiCtrl.getServers);
router.post('/getPlans', apiCtrl.getPlans);

router.post('/activateBranch', apiCtrl.activateBranch);
router.post('/pauseBranch', apiCtrl.pauseBranch);
router.post('/deleteBranch', apiCtrl.deleteBranch);

router.post('/createSubscription', apiCtrl.createSubscription);
router.post('/changePlan', apiCtrl.changePlan);
router.post('/renewSubscription', apiCtrl.renewSubscription);
router.post('/getSubscriptionAmount', apiCtrl.getSubscriptionAmount);
router.post('/isPrefixValid', apiCtrl.isPrefixValid);
router.post('/checkout', apiCtrl.checkout);

module.exports = router;
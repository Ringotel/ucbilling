var express = require('express');
var router = express.Router();
var customersCtrl = require('../controllers/customers');
// var transactionsCtrl = require('../controllers/transactions');
// var chargesCtrl = require('../controllers/charges');
// var plansCtrl = require('../controllers/plans');
// var serversCtrl = require('../controllers/servers');
// var branchesCtrl = require('../controllers/branches');
var subsCtrl = require('../controllers/subscriptions');
var plansCtrl = require('../controllers/plans');
var authCtrl = require('../controllers/auth-partners');
var validateRequest = require('../middlewares/validateRequest');

module.exports = router;

/****************************************
*			Unauthorized zone				*
*****************************************/

/*** Authorization Routes ***/
// router.post('/authorize', authCtrl.authorize);
router.post('/login', authCtrl.login);
// router.post('/requestPasswordReset', authCtrl.requestPasswordReset);
// router.post('/resetPassword', authCtrl.resetPassword);
// router.get('/verify-email/*', authCtrl.verify);

/*** Validation Middleware. Don't move it!!! ***/
router.use(validateRequest);

/****************************************
*			Authorized zone				*
*****************************************/

router.get('/loggedin', authCtrl.loggedin);

router.use(function (req, res, next){
	req.body.partnerId = req.decoded._id;
	next();
});

/*** Customers Routes ***/
router.get('/customers', customersCtrl.getAll);
router.get('/customers/:id', customersCtrl.get);
router.post('/customers', customersCtrl.create);
router.put('/customers/:id', customersCtrl.update);

/*** Subscriptions Routes ***/
router.get('/subscriptions', subsCtrl.getAll);
router.put('/subscriptions/:id', subsCtrl.update);
router.post('/subscriptions', subsCtrl.create);

/*** Plans Routes ***/
router.get('/plans', plansCtrl.getCustomPlans);
router.post('/plans', plansCtrl.create);
router.put('/plans/:id', plansCtrl.update);

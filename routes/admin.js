var express = require('express');
var router = express.Router();
// var authCtrl = require('../controllers/auth-branch');
// var addonsCtrl = require('../controllers/addons');
// var customersCtrl = require('../controllers/customers');
// var couponsCtrl = require('../controllers/coupons');
// var subsCtrl = require('../controllers/subscriptions');
// var serversCtrl = require('../controllers/servers');
// var branchesCtrl = require('../controllers/branches');
// var subsCtrl = require('../controllers/subscriptions');
var plansCtrl = require('../controllers-admin/plans');
// var invoicesCtrl = require('../controllers/invoices');
// var discountsCtrl = require('../controllers/discounts');
// var didCtrl = require('../controllers/dids');
var validateRequest = require('../middlewares/validateRequest');

module.exports = router;

/****************************************
*			Unauthorized zone			*
*****************************************/
/*** Authorization Routes ***/
// router.post('/authorize', authCtrl.authorize);

/*** Validation Middleware. Don't move it!!! ***/
router.use(validateRequest);

/****************************************
*			Authorized zone				*
*****************************************/

// router.get('/subscriptions', subsCtrl.getAll);

// router.get('/addons', addonsCtrl.getAllRequest);
// router.post('/addons/add', addonsCtrl.add);
// router.post('/addons/update/:id', addonsCtrl.update);
// router.get('/addons/get/:id', addonsCtrl.get);
// router.post('/addons/delete/:id', addonsCtrl.deleteIt);

// router.get('/invoices', invoicesCtrl.getAll);
// router.post('/invoices/add', invoicesCtrl.add);
// router.post('/invoices/update/:id', invoicesCtrl.update);
// router.get('/invoices/get/:id', invoicesCtrl.get);
// router.post('/invoices/delete/:id', invoicesCtrl.deleteIt);

// router.get('/discounts', discountsCtrl.getAll);
// router.post('/discounts/add', discountsCtrl.add);
// router.post('/discounts/update/:id', discountsCtrl.update);
// router.get('/discounts/get/:id', discountsCtrl.get);
// router.post('/discounts/delete/:id', discountsCtrl.deleteIt);

// router.get('/coupons', couponsCtrl.getAll);
// router.post('/coupons/add', couponsCtrl.add);
// router.post('/coupons/update/:id', couponsCtrl.update);
// router.get('/coupons/get/:id', couponsCtrl.get);
// router.post('/coupons/delete/:id', couponsCtrl.deleteIt);

router.get('/plans', plansCtrl.getAll);
router.post('/plans/add', plansCtrl.add);
router.post('/plans/update/:id', plansCtrl.update);
router.get('/plans/get/:id', plansCtrl.getById);
router.post('/plans/delete/:id', plansCtrl.deleteById);

// router.get('/servers', serversCtrl.getAll);
// router.post('/servers/add', serversCtrl.add);
// router.post('/servers/update/:id', serversCtrl.update);
// router.get('/servers/get/:id', serversCtrl.getRequest);
// router.post('/servers/delete/:id', serversCtrl.deleteIt);

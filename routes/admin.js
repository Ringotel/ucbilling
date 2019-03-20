var express = require('express');
var router = express.Router();
var authCtrl = require('../controllers-admin/auth');
var addonsCtrl = require('../controllers-admin/addons');
var couponsCtrl = require('../controllers-admin/coupons');
var serversCtrl = require('../controllers-admin/servers');
var subsCtrl = require('../controllers-admin/subscriptions');
var plansCtrl = require('../controllers-admin/plans');
var invoicesCtrl = require('../controllers-admin/invoices');
var discountsCtrl = require('../controllers-admin/discounts');
var partnersCtrl = require('../controllers-admin/partners');
var validateRequest = require('../middlewares/validateRequest');

module.exports = router;

/****************************************
*			Unauthorized zone			*
*****************************************/
/*** Authorization Routes ***/
router.post('/login', authCtrl.login);

/*** Validation Middleware. Don't move it!!! ***/
router.use(validateRequest);

/****************************************
*			Authorized zone				*
*****************************************/

router.post('/subscriptions', subsCtrl.getAll);

router.post('/partners/create', partnersCtrl.create);

router.post('/addons', addonsCtrl.getAllRequest);
router.post('/addons/add', addonsCtrl.add);
router.post('/addons/update/:id', addonsCtrl.update);
router.post('/addons/get/:id', addonsCtrl.get);
router.post('/addons/delete/:id', addonsCtrl.deleteIt);

router.post('/invoices', invoicesCtrl.getAll);
router.post('/invoices/add', invoicesCtrl.add);
router.post('/invoices/update/:id', invoicesCtrl.update);
router.post('/invoices/get/:id', invoicesCtrl.get);
router.post('/invoices/delete/:id', invoicesCtrl.deleteIt);

router.post('/discounts', discountsCtrl.getAll);
router.post('/discounts/add', discountsCtrl.add);
router.post('/discounts/update/:id', discountsCtrl.update);
router.post('/discounts/get/:id', discountsCtrl.get);
router.post('/discounts/delete/:id', discountsCtrl.deleteIt);

router.post('/coupons', couponsCtrl.getAll);
router.post('/coupons/add', couponsCtrl.add);
router.post('/coupons/update/:id', couponsCtrl.update);
router.post('/coupons/get/:id', couponsCtrl.get);
router.post('/coupons/delete/:id', couponsCtrl.deleteIt);

router.post('/plans', plansCtrl.getAll);
router.post('/plans/add', plansCtrl.add);
router.post('/plans/update/:id', plansCtrl.update);
router.post('/plans/get/:id', plansCtrl.getById);
router.post('/plans/delete/:id', plansCtrl.deleteById);

router.post('/servers', serversCtrl.getAll);
router.post('/servers/add', serversCtrl.add);
router.post('/servers/update/:id', serversCtrl.update);
router.post('/servers/get/:id', serversCtrl.getRequest);
router.post('/servers/delete/:id', serversCtrl.deleteIt);

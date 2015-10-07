var express = require('express');
var router = express.Router();
var addonsCtrl = require('../../controllers/addons');
var discountsCtrl = require('../../controllers/discounts');
var plansCtrl = require('../../controllers/plans');
var serversCtrl = require('../../controllers/servers');
var authCtrl = require('../../controllers/auth');

router.use(require('../../middlewares/validateRequest'));

router.get('/loggedin', authCtrl.loggedin);

router.post('/addons', addonsCtrl.getAllRequest);
router.post('/addons/add', addonsCtrl.add);
router.post('/addons/update/:id', addonsCtrl.update);
router.post('/addons/get/:id', addonsCtrl.get);
router.post('/addons/delete/:id', addonsCtrl.deleteIt);

router.post('/discounts', discountsCtrl.getAll);
router.post('/discounts/add', discountsCtrl.add);
router.post('/discounts/update/:id', discountsCtrl.update);
router.post('/discounts/get/:id', discountsCtrl.get);
router.post('/discounts/delete/:id', discountsCtrl.deleteIt);

router.post('/plans/', plansCtrl.getAll);
router.post('/plans/add', plansCtrl.add);
router.post('/plans/update/:id', plansCtrl.update);
router.post('/plans/get/:id', plansCtrl.getRequest);
router.post('/plans/delete/:id', plansCtrl.deleteIt);

router.post('/servers/', serversCtrl.getAll);
router.post('/servers/add', serversCtrl.add);
router.post('/servers/update/:id', serversCtrl.update);
router.post('/servers/get/:id', serversCtrl.getRequest);
router.post('/servers/delete/:id', serversCtrl.deleteIt);

module.exports = router;
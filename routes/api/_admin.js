var express = require('express');
var router = express.Router();
var addonsCtrl = require('../../controllers/addons');
var plansCtrl = require('../../controllers/plans');
var serversCtrl = require('../../controllers/servers');
	
router.post('addons/', addonsCtrl.getAll);
router.post('addons/add', addonsCtrl.add);
router.post('addons/update/:id', addonsCtrl.update);
router.post('addons/get/:id', addonsCtrl.get);
router.post('addons/delete/:id', addonsCtrl.deleteIt);

router.post('plans/', plansCtrl.getAll);
router.post('plans/add', plansCtrl.add);
router.post('plans/update/:id', plansCtrl.update);
router.post('plans/get/:id', plansCtrl.get);
router.post('plans/delete/:id', plansCtrl.deleteIt);

router.post('servers/', plansCtrl.getAll);
router.post('servers/add', plansCtrl.add);
router.post('servers/update/:id', plansCtrl.update);
router.post('servers/get/:id', plansCtrl.get);
router.post('servers/delete/:id', plansCtrl.deleteIt);

module.exports = router;
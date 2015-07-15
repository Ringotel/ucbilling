var express = require('express');
var router = express.Router();
var customersCtrl = require('../../controllers/customers');
var subscriptionsCtrl = require('../../controllers/subscriptions');
var apiCtrl = require('../../controllers/api');
	
router.post('/create', customersCtrl.create);
router.post('/update/:id', customersCtrl.update);
router.post('/get/:id', customersCtrl.get);
router.post('/delete/:id', customersCtrl.deleteIt);

router.post('/getBranches', apiCtrl.getBranches);

router.post('subscriptions/add', subscriptionsCtrl.add);
router.post('subscriptions/update', subscriptionsCtrl.update);
router.post('subscriptions/updateState', subscriptionsCtrl.updateState);
router.post('subscriptions/cancel', subscriptionsCtrl.cancel);

module.exports = router;
var express = require('express');
var router = express.Router();
var customersCtrl = require('../../controllers/customers');
var subscriptionsCtrl = require('../../controllers/subscriptions');
var authCtrl = require('../../controllers/auth');
var apiCtrl = require('../../controllers/api');
var debug = require('debug')('billing');

router.post('/login', authCtrl.login);
router.post('/signup', authCtrl.signup);

router.use(require('../../middlewares/validateRequest'));

router.get('/loggedin', authCtrl.loggedin);
	
router.post('/create', customersCtrl.create);
router.post('/update/:id', customersCtrl.update);
router.post('/get/:id', customersCtrl.get);
router.post('/delete/:id', customersCtrl.deleteIt);

router.post('/getBranches', apiCtrl.getBranches);
router.post('/createBranch', apiCtrl.createBranch);
router.post('/updateBranch', apiCtrl.updateBranch);
router.post('/setBranchState', apiCtrl.setBranchState);
router.post('/deleteBranch', apiCtrl.deleteBranch);

module.exports = router;
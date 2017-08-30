var express = require('express');
var router = express.Router();
var startCtrl = require('../controllers/start');
var validateRequest = require('../middlewares/validateRequest');

module.exports = router;

/****************************************
*			Unauthorized zone				*
*****************************************/

/*** Create new request from the website ***/
router.post('/start', startCtrl.newRequest);
router.get('/setup', startCtrl.setup);

/*** Validation Middleware. Don't move it!!! ***/
router.use(validateRequest);

/****************************************
*			Authorized zone				*
*****************************************/

router.use(function (req, res, next){
	req.body.customerId = req.decoded._id;
	next();
});

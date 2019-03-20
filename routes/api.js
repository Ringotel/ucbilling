var express = require('express');
var router = express.Router();
var debug = require('debug')('billing');
var authCtrl = require('../controllers/auth-branch');
var getLocation = require('../modules/geolocation.js').getLocation;

module.exports = router;

/****************************************
*			Unauthorized zone				*
*****************************************/

router.get('/ping', function(req, res, next) {
	res.send('OK');
});

router.get('/appnews', function(req, res, next) {
	res.render('appnews/index');
})

router.post('/signup', authCtrl.signup);
router.post('/verify', authCtrl.verify);
router.post('/create', authCtrl.createBranch);

router.get('/getBranchLink', authCtrl.getBranchLink);
router.post('/sendBranchLink', authCtrl.sendBranchLink);

router.get('/getLocation', function(req, res, next) {
	var ip = req.get('X-Forwarded-For');
	if(!ip) return next(new Error({ name: 'ERR_MISSING_ARGS', message: 'Missing data' }));

	// getLocation({ ip: '91.203.91.255' }, function(err, result) {
	getLocation({ ip: ip }, function(err, result) {
		debug('getLocation:', ip, err, result);
		if(err) {
			if(err instanceof Error) return next(err);
			return res.json({ success: false, error: err });
		}
		res.json({ success: true, result: result });
	});
});


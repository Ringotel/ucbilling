var express = require('express');
var router = express.Router();
var debug = require('debug')('billing');

module.exports = router;

/****************************************
*			Unauthorized zone				*
*****************************************/

router.get('/ping', function(req, res, next) {
	res.send('OK');
});
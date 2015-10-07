var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var adminAuth = require('../controllers/adminAuth');
var authCtrl = require('../controllers/auth');

router.post('/login', adminAuth.login);
// router.post('/signup', adminAuth.signup);

router.get('/', function (req, res, next){
	res.sendFile(path.join(__dirname + '../../app/index.html'));
});

module.exports = router;
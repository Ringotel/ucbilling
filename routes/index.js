var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var authCtrl = require('../controllers/auth');

router.post('/login', authCtrl.login);
router.post('/signup', authCtrl.signup);

router.get('/', function (req, res, next){
	res.sendFile(path.join(__dirname + '../../app/index.html'));
});

module.exports = router;
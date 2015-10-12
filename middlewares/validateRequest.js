var jwt = require('jsonwebtoken');
var debug = require('debug')('billing');

module.exports = function(req, res, next){

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, require('../env/index').secret, function (err, decoded) {
			if (err) {
				// var error = new Error('NOT_AUTHORIZED');
				// error.status = 403;
				// next(error);
				res.status(403).json({
					success: false,
					message: 'NOT_AUTHORIZED'
				});
			} else if(decoded.state === 'suspended'){
				// var error = new Error('INVALID_ACCOUNT');
				// error.status = 403;
				// next(error);
				res.status(403).json({
					success: false,
					message: 'INVALID_ACCOUNT'
				});
			} else if(decoded.exp > Date.now()){
				// var error = new Error('NOT_AUTHORIZED');
				// error.status = 403;
				// next(error);
				res.status(403).json({
					success: false,
					message: 'NOT_AUTHORIZED'
				});
			} else {
				if((req.originalUrl.indexOf('/admin') !== -1 && decoded.role === 'admin') || (req.originalUrl.indexOf('/customer') !== -1 && decoded.role === 'user')){
					// if everything is good, save to request for use in other routes
					delete decoded.password;
					req.decoded = decoded;
					next(); //move to next middleware
				} else {
					// var error = new Error('NOT_AUTHORIZED');
					// error.status = 403;
					// next(error);
					res.status(403).json({
						success: false,
						message: 'NOT_AUTHORIZED'
					});
				}
			}
		});
	} else {
		// if there is no token
		// return an error
		// var error = new Error('MISSING_TOKEN');
		// error.status = 403;
		// next(error);
		return res.status(403).json({
			success: false,
			message: 'MISSING_TOKEN'
		});
	}

};
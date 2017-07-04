var jwt = require('jsonwebtoken');
var debug = require('debug')('billing');

function checkRole(req, user) {
	if(
		(req.originalUrl.indexOf('/admin') !== -1 && user.role === 'admin') ||
		(req.originalUrl.indexOf('/reseller') !== -1 && user.role === 'reseller') ||
		(req.originalUrl.indexOf('/branch') !== -1 && user.role === 'branchAdmin') ||
		(req.originalUrl.indexOf('/user') !== -1 && user.role === 'user')
	) {
		return true;
	}

	return false;

}

module.exports = function(req, res, next){

	// check header or url parameters or post parameters for token
	var token = req.body.token || (req.query.token ? decodeURIComponent(req.query.token) : '') || req.headers['x-access-token'];

	// decode token
	if (token) {
		debug('validateRequest token: ', token);
		// verifies secret and checks exp
		jwt.verify(token, require('../env/index').tokenSecret, function (err, decoded) {
			debug('validateRequest decoded: ', err, decoded);

			if (err) {
				// var error = new Error('NOT_AUTHORIZED');
				// error.status = 403;
				// next(error);
				res.status(403).json({
					success: false,
					message: err
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
					message: 'TOKEN_EXPIRED'
				});
			} else {
				if(checkRole(req, decoded)){
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
var jwt = require('jsonwebtoken');
var debug = require('debug')('billing');

function checkRole(req, user) {
	if(
		(req.originalUrl.indexOf('/admin') !== -1 && user.role === 'admin') ||
		(req.originalUrl.indexOf('/partner') !== -1 && user.role === 'partner') ||
		(req.originalUrl.indexOf('/branch') !== -1 && user.role === 'branchAdmin') ||
		(req.originalUrl.indexOf('/user') !== -1 && user.role === 'user')
	) {
		return true;
	}

	return false;

}

module.exports = function(req, res, next){

	// check header or url parameters or post parameters for token
	var token = req.body.access_token || (req.query.access_token ? decodeURIComponent(req.query.access_token) : '') || req.headers['x-access-token'];

	// decode token
	if (token) {
		debug('validateRequest token: ', token);
		// verifies secret and checks exp
		jwt.verify(token, require('../env/index').tokenSecret, function (err, decoded) {
			debug('validateRequest decoded: ', err, decoded);

			if (err) {
				res.status(403).json({
					success: false,
					message: err
				});
			} else if(decoded.state === 'suspended'){
				res.status(403).json({
					success: false,
					message: 'INVALID_ACCOUNT'
				});
			} else if(decoded.exp > Date.now()){
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
					res.status(403).json({
						success: false,
						message: 'NOT_AUTHORIZED'
					});
				}
			}
		});
	} else {
		// if there is no token
		return res.status(403).json({
			success: false,
			message: 'MISSING_TOKEN'
		});
	}

};
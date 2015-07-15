var jwt = require('jsonwebtoken');
var debug = require('debug')('billing');

module.exports = function(req, res, next){

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, require('../config/server').secret, function(err, decoded) {

			if (err) {
				debug('token verification error: ', err);
				res.status(403).json({
					success: false,
					message: 'Failed to authenticate token. Token expired.'
				});
			} else {

				if((req.originalUrl.indexOf('/admin') !== -1 && decoded.role === 'admin') || (req.originalUrl.indexOf('/admin') === -1 && req.originalUrl.indexOf('/customer') !== -1)){
					// if everything is good, save to request for use in other routes
					req.decoded = decoded;
					next(); //move to next middleware
				} else {
					debug('url: ', req.url);

					res.status(403).json({
						success: false,
						message: 'Not Authorized'
					});
				}
			}
		});
	} else {
		// if there is no token
		// return an error
		return res.status(403).json({
			success: false,
			message: 'No token provided.'
		});
	}

};
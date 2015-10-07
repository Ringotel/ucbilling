var bcrypt = require('bcrypt');

module.exports = function(pass, cb){
	bcrypt.genSalt(10, function(err, salt) {
	    if (err) {
	    	cb(err);
	    	return;
	    }

	    // hash the password using our new salt
	    bcrypt.hash(pass, salt, function(err, hash) {
	        if (err) {
	        	cb(err);
	        	return;
	        };
	        // return hashed password
	        return cb(null, hash);
	    });
	});
}
	
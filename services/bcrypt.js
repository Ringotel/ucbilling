var bcrypt = require('bcryptjs');

module.exports = {
	hash: function(password, cb) {
		bcrypt.genSalt(10, function(err, salt) {
			if (err) {
				cb(err);
				return;
			}

			// hash the password using our new salt
			bcrypt.hash(password, salt, function(err, hash) {
				if (err) {
					cb(err);
					return;
				}
				// return hashed password
				return cb(null, hash);
			});
		});
	},
	compare: function(password, hash, cb) {
		bcrypt.compare(password, hash, function(err, isMatch){
			if(err) cb(err);
			else cb(null, isMatch);
		});
	}
};
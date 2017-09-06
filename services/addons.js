var Addons = require('../models/addons');

var methods = {

	get: function(query, projection){
		var promise = Addons.find(query || {});
		if(projection) promise.select(projection);
		return promise.lean().exec();
	}

};

module.exports = methods;

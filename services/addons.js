var Addons = require('../models/addons');

var methods = {

	get: function(query){
		return Addons.find(query || {}).lean().exec();
	}

};

module.exports = methods;

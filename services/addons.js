var Addon = require('../models/addons');

var methods = {

	get: function(query){
		return Addon.find(query || {}).lean().exec();
	}

};

module.exports = methods;

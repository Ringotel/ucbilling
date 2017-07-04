module.exports = {
	extend: function(a, b){
		for( var key in b ) {
		    if( b.hasOwnProperty( key ) ) {
		        a[key] = b[key];
		    }
		}
		return a;
	},
	deepExtend: function(destination, source) {
		for (var property in source) {
			if (source[property] && source[property].constructor && source[property].constructor === Object) {
				destination[property] = destination[property] || {};
				arguments.callee(destination[property], source[property]);
			} else {
				destination[property] = source[property];
			}
		}
		return destination;
	},
	isArray: function(obj){
		return Array.isArray(obj);
	},
	convertBytes: function(value, fromUnits, toUnits){
	    var coefficients = {
	        'Byte': 1,
	        'KB': 1000,
	        'MB': 1000000,
	        'GB': 1000000000
	    }
	    return value * coefficients[fromUnits] / coefficients[toUnits];
	}
};
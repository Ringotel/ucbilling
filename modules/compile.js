
module.exports = { compile };

function compile(string, params) {
	return string.replace(/{{(\w*)}}/g, function(match, param, offset, result) {
		if(params[param]) return params[param];
	})
}
var config = require('../env/index');
var fs = require('fs');
var path = require('path');
var hbs = require('hbs');
var source = fs.readFileSync(path.resolve('views/email_template.html')).toString();
var templateStr;
var logger = require('./logger').mailer;
var debug = require('debug')('billing');
var mailer = require('sendgrid')(config.sendgridApiKey);

function getBody(params, callback) {
	fs.readFile(path.resolve('views/partials/'+params.lang+'/'+params.body+'.html'), function (err, data){
		if(err) return callback(err);
		hbs.registerPartial('message', data.toString());
		templateStr = renderTemplate(source, params);
		callback(null, templateStr);
	});
}

function renderTemplate(source, data){
	var template = hbs.compile(source);
	var output = template(data);
	return output;
}

module.exports = {
	send: function(params, callback) {
		getBody(params, function(err, body) {
			if(err) return callback(err);

			var request = mailer.emptyRequest();
			request.body = {
				"from": {
					"email": params.from.address,
					"name": params.from.name
				},
				"content": [{
					"type": "text/html",
					"value": body
				}],
				"personalizations": [{
					"to": [{
						"email": params.to
					}],
					"subject": params.subject
				}]
			};
			if(params.template_id) request.body["template_id"] = params.template_id;
			request.method = 'POST';
			request.path = '/v3/mail/send';
			mailer.API(request, function (err, result) {
				if(err) {
					logger.error(err);
					return callback(err);
				}
				logger.info('Mail send', params);
				callback(null, result.body);
			});
		});
	},

	addToSublist: function(params, callback) {
		var request = mailer.emptyRequest();
		request.body = params;
		request.method = 'POST';
		request.path = '/v3/contactdb/recipients';
		mailer.API(request, function (err, result) {
			if(err) {
				logger.error(err);
				return callback(err);
			}
			logger.info('Mail send', params);
			callback(null, result.body);
		});
	}
};
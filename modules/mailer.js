var fs = require('fs');
var path = require('path');
var hbs = require('hbs');
var source = fs.readFileSync(path.resolve('views/email_template.html')).toString();
var nodemailer = require('nodemailer');
var translations = require('../translations/mailer.json');
var templateStr;
var logger = require('./logger').mailer;
var debug = require('debug')('billing');

var mailer = nodemailer.createTransport({
	port: 465,
	host: 'mail.ringotel.co',
	secure: true,
	// ignoreTLS: true,
	tls: {
		rejectUnauthorized: false
	},
	auth: {
		user: 'service@ringotel.co',
		pass: 'm2gA9o$4'
	}
});

function getBody(params, callback) {
	fs.readFile(path.resolve('views/partials/'+params.lang+'/'+params.template+'.html'), function (err, data){
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
		getBody(params, function(err, template) {
			if(err) return callback(err);

			mailer.sendMail({
				from: params.from,
				to: params.to,
				subject: params.subject,
				html: template
			}, function (err, result){
				if(err) {
					logger.error(err);
					return callback(err);
				}
				logger.info('Mail send', params);
				callback(null, result);
			});
		});
	}
};
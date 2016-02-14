var fs = require('fs');
var path = require('path');
var hbs = require('hbs');
var source = fs.readFileSync(path.resolve('views/email_template.html')).toString();
var nodemailer = require('nodemailer');
var translations = require('../translations/mailer.json');
var templateStr;

var mailer = nodemailer.createTransport({
	port: 465,
	host: 'mail.ringotel.co',
	secure: true,
	ignoreTLS: true,
	tls: {
		rejectUnauthorized: false
	},
	auth: {
		user: 'service@ringotel.co',
		pass: 'm2gA9o$4'
	}
});

var methods = {
	resetPassword: function(params, callback){
		fs.readFile(path.resolve('views/partials/'+params.lang+'/reset_password.html'), function (err, data){
			if(err) return callback(err);
			hbs.registerPartial('message', data.toString());
			templateStr = renderTemplate(source, params);
			mailOpts = MailOpts({
				to: params.email,
				subject: translations[params.lang].RESET_PASSWORD.SUBJECT,
				html: templateStr
			});
			callback(null, mailOpts);
		});
	},
	confirmAccount: function(params, callback){
		fs.readFile(path.resolve('views/partials/'+params.lang+'/confirm_account.html'), function (err, data){
			if(err) return callback(err);
			hbs.registerPartial('message', data.toString());
			templateStr = renderTemplate(source, params);
			mailOpts = MailOpts({
				to: params.email,
				subject: translations[params.lang].CONFIRM_ACCOUNT.SUBJECT,
				html: templateStr
			});
			callback(null, mailOpts);
		});
	}
};

function MailOpts(opts){
	var obj = {
		from: {
			name: "Ringotel Service Support",
			address: "service@ringotel.co"
		},
		to: opts.to,
		subject: opts.subject,
		html: opts.html
	};
	return obj;
}

function renderTemplate(source, data){
	var template = hbs.compile(source);
	var output = template(data);
	return output;
}

module.exports = {
	sendMail: function(method, params, callback){
		methods[method](params, function (err, opts){
			if(err) return callback(err);

			mailer.sendMail(opts, function (err, result){
				if(err) return callback(err);

				callback(null, result);
			});
		});
	}
};
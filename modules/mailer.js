var config = require('../env/index');
var fs = require('fs');
var path = require('path');
var hbs = require('hbs');
var source = fs.readFileSync(path.resolve('views/email_template.html')).toString();
var templateStr;
var logger = require('./logger').mailer;
var debug = require('debug')('billing');
var mailer = require('sendgrid')(config.sendgridApiKey);

module.exports = { send, addToSublist, selfNotify };

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

function send(params, callback) {
	var request = mailer.emptyRequest();
	request.body = {
		from: {
			email: params.from.address,
			name: params.from.name
		},
		content: [{
			type: "text/html"
			// "value": body
		}],
		personalizations: [{
			to: [{
				email: params.to
			}],
			subject: params.subject
		}]
	};
	if(params.template_id) request.body["template_id"] = params.template_id;
	request.method = 'POST';
	request.path = '/v3/mail/send';

	if(params.content) {
		request.body.content = [{ type: "text/plain", value: params.content }];
		sendViaApi(request, callback);
	} else if(params.body) {
		getBody(params, function(err, body) {
			if(err) return callback(err);
			request.body.content = [{ type: "text/html", value: body }];
			sendViaApi(request, callback);
		});
	} else {
		callback({ name: 'ERR_MISSING_ARGS', message: 'Missing content or body' });
	}
}

function sendViaApi(request, callback) {
	debug('sendViaApi: ', request);
	mailer.API(request, function (err, result) {
		if(err) {
			logger.error(err);
			debug('mailer send error: ', err.response.body.errors);
			return callback(err);
		}
		callback(null, result.body);
	});
}

function addToSublist(params, callback) {
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

function selfNotify(params, callback) {
	send({
		from: {
			name: "Ringotel Auto Service",
			address: "service@ringotel.co"
		},
		to: config.teamEmail,
		subject: params.subject, // translations[params.lang].TEAM_NOTIFY_EARLY_ACCESS_ACCEPT.SUBJECT,
		body: params.body, // 'team_notify_early_access_accepted',
		lang: 'en', // params.lang,
		name: 'Ringotel Team',
		template_id: '98ac2079-34b7-4e77-a872-c01ebf96fd32',
		customer: params.customer
	}, function(err, result){
		debug('mailer result: ', err, result);
		if(callback) {
			if(err) return callback(err);
			callback();
		}
	});
}

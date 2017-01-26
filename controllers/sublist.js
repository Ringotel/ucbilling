var debug = require('debug')('billing');
var mailer = require('../modules/mailer');
var translations = require('../translations/mailer.json');

function sendSuccessEmail(params, cb) {
	mailer.send({
		from: {
			name: "Ringotel Service Support",
			address: "support@ringotel.co"
		},
		to: params.email,
		subject: translations[params.lang].EARLY_ACCESS_ACCEPT.SUBJECT,
		body: 'early_access_accepted',
		lang: params.lang,
		name: params.full_name,
		template_id: '98ac2079-34b7-4e77-a872-c01ebf96fd32'
	}, function(err, result){
		debug('mailer result: ', err, result);
		if(err) return cb(err);
		cb();
	});
}

module.exports = {
	add: function(req, res, next) {

		var params = req.body;

		debug('sublist add: ', params);
		mailer.addToSublist(params, function(err, result) {
			// debug('sublist error: ', err.response.body.errors);
			debug('sublist error: ', err);
			debug('sublist result: ', result);
			if(err) {
				return next(new Error(err));
			}

			sendSuccessEmail(params[0], function(err) {
				debug('sendSuccessEmail: ', params, err);
			})

			res.json({
				success: true
			});
		});

	}
};
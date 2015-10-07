var nodemailer = require('nodemailer');

module.exports = nodemailer.createTransport({
	port: 465,
	host: 'mail.smile-soft.com',
	secure: true,
	ignoreTLS: true,
	tls: {
		rejectUnauthorized: false
	},
	auth: {
		user: 'noreply@smile-soft.com',
		pass: 'wwoV022'
	}
});
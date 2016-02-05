var mysql = require('mysql');
var config = require('../env/index');
var connection = mysql.createConnection({
	host: config.mydns.host,
	user: config.mydns.user,
	password: config.mydns.password,
	database: config.mydns.database
});

module.exports = {
	get: function(params, callback) {
		connection.query('SELECT name FROM rr WHERE name = ?', [params.prefix], function(err, rows, fields) {
			if(err) return callback(err);
			callback(null, results, fields);
		});
	},

	create: function(params, callback) {
		connection.query('INSERT INTO rr SET ?', {zone: 1, name: params.prefix, type: 'ALIAS', data: params.domain}, function(err, result) {
			if(err) return callback(err);
			callback(null, result.insertId);
		});
	},

	remove: function(params, callback) {
		connection.query('DELETE FROM rr WHERE name = ?', [params.prefix], function(err, result) {
			if(err) return callback(err);
			callback(null, result.affectedRows);
		});
	}
};
var mysql = require('mysql');
var config = require('../env/index');
var connection = mysql.createConnection({
	host: config.mydns.host,
	user: config.mydns.user,
	password: config.mydns.password,
	database: config.mydns.database
});
var debug = require('debug')('billing');

module.exports = {
	get: function(params, callback) {
		connection.query('SELECT name FROM records WHERE name = ?', [params.prefix+'.'+config.domain], function(err, rows, fields) {
			if(err) return callback(err);
			debug('dns get result: ', rows, fields);
			callback(null, rows, fields);
		});
	},

	create: function(params, callback) {
		connection.query('INSERT INTO records SET ?', {domain_id: 1, name: params.prefix+'.'+config.domain, type: 'CNAME', content: params.domain, ttl: 86400}, function(err, result) {
			if(err) return callback(err);
			callback(null, result.insertId);
		});
	},

	remove: function(params, callback) {
		connection.query("DELETE FROM records WHERE name = '"+params.prefix+"."+config.domain+"' and type = 'CNAME'", function(err, result) {
			if(err) return callback(err);
			callback(null, result.affectedRows);
		});
	}
};
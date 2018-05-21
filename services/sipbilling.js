var mysql = require('mysql');
var config = require('../env/index');
var connection = mysql.createConnection({
	host: config.sipbilling.host,
	user: config.sipbilling.user,
	password: config.sipbilling.password,
	database: config.sipbilling.database
});
var debug = require('debug')('billing');

module.exports = {
	createAccount: function(params) {
		debug('createAccount: ', params);
		return new Promise((resolve, reject) => {
			connection.query('INSERT INTO ACCOUNTS SET ?', {acid: params.customer, balance: 0, credit: 0, discount: 0, owner: 0, dealer: 0, activated: Date.now(), lifetime: (86400000*365*20), packageid: 2, options: 0}, function(err, result) {
				if(err) return reject(err);
				resolve();
			});
		});
	},

	addNumber: function(params) {
		return new Promise((resolve, reject) => {
			connection.query('INSERT INTO CALLERID SET ?', {acid: params.customer, callingnumber: params.number, uname: params.number, numbertype: 2}, function(err, result) {
				if(err) return reject(err);
				resolve();
			});
		});
	},

	setBalance: function(params) {
		debug('setBalance: ', params);
		return new Promise((resolve, reject) => {
			connection.query("UPDATE ACCOUNTS SET balance = "+params.balance+" WHERE acid = '"+params.customer+"'", function(err, rows, fields) {
				if(err) return reject(err);
				debug('addToBalance result: ', rows, fields);
				resolve();
			});
		});
	},

	getBalance: function(params) {
		return new Promise((resolve, reject) => {
			connection.query("SELECT balance FROM ACCOUNTS WHERE acid = '"+params.customer+"'", function(err, result) {
				if(err) return reject(err);
				resolve(result[0]);
			});
		});
	},

	deleteNumber: function(params) {
		return new Promise((resolve, reject) => {
			connection.query("DELETE FROM CALLERID WHERE callingnumber = '"+params.number+"' and acid = '"+params.customer+"'", function(err, result) {
				if(err) return reject(err);
				resolve();
			});
		});
	}
};
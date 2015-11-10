module.exports = {
    bdb: process.env.MONGODB || 'mongodb://localhost:27017/uccblg',
    agendadb: process.env.AGENDADB || 'mongodb://localhost:27017/ajobs',
    port: process.env.PORT || 3003,
    apphost: process.env.APP_HOST || 'localhost:3002',
    secret: process.env.JWT_SECRET || 'qwerty123',
    sessionTimeInSeconds: 1800,
    logMaxSize: 2097152,
    logPath: 'log',
    liqpay: {
		publickey: "i36031725468",
		privatekey: "zdZroWbVrODopLZWmx42KTTSuIaWeKAXTQRkwABd",
		serverUrl: "http://localhost:3003",
        resultUrl: "http://localhost:3002"
    }
};


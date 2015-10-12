module.exports = {
    bdb: process.env.MONGODB || 'mongodb://localhost:27017/uccblg',
    agendadb: process.env.AGENDADB || 'mongodb://localhost:27017/agendajobs',
    port: process.env.PORT || 3003,
    secret: process.env.JWT_SECRET || 'qwerty123',
    sessionTimeInSeconds: 1800,
    logMaxSize: 2097152,
    logPath: 'log',
    liqpay: {
		publickey: "i36031725468",
		privatekey: "zdZroWbVrODopLZWmx42KTTSuIaWeKAXTQRkwABd",
		resultUrl: "http://3d3e10ad.ngrok.io"
    }
};


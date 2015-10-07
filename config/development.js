module.exports = {
    bdb: process.env.MONGODB || 'mongodb://localhost:27017/uccblg',
    agendadb: process.env.AGENDADB || 'mongodb://localhost:27017/agendajobs',
    port: process.env.PORT || 3003,
    secret: process.env.JWT_SECRET || 'qwerty123',
    sessionTimeInSeconds: 1800,
    logMaxSize: 4194304,
    logPath: 'log',
    liqpay: {
		publickey: "",
		privatekey: "",
		resultUrl: "http://66be6cb6.ngrok.io"
    }
};


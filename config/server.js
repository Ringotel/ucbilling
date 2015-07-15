module.exports = {
    bdb: process.env.MONGODB || 'mongodb://localhost:27017/uccblg',
    agendadb: process.env.AGENDADB || 'mongodb://localhost:27017/agendajobs',
    port: process.env.PORT || 3003,
    secret: process.env.JWT_SECRET || 'Bjcba,tyVfnnfabq'
};

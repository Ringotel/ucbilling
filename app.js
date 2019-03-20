var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var path = require('path');
var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var helmet = require('helmet');
var config = require('./env/index');
var fs = require('fs');
var debug = require('debug')('billing');
var apiLogger = require('./modules/logger').api;
var httpLogger = require('./modules/logger').http;

app.use(helmet());

mongoose.connect(config.bdb, { useMongoClient: true, autoIndex: false });
mongoose.Promise = global.Promise;

// mongoose.connect(config.bdb, config.dbConf);

app.set('views', path.resolve('views'));
app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

httpLogger.stream = {
    write: function(message, encoding){
        httpLogger.info(message);
    }
};
app.use(morgan("combined", { stream: httpLogger.stream }));

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'x-access-token, X-Requested-With, Content-type, Content-length, Authorization');
    next();
});
app.use(express.static(path.resolve('app')));

// Response to preflight requests
app.options("/*", function(req, res, next){
    res.sendStatus(200);
});

app.use('/subscribers', require('./routes/subscribers'));
app.use('/branch/api', require('./routes/branch'));
app.use('/api', require('./routes/api'));

// API V2
app.use('/partner/api_v2', require('./routes/partner'));

// app.use('/', require('./routes/index'));

//===============Error handlers================

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('not found');
    err.status = 404;
    next(err);
});

// log errors
app.use(function(err, req, res, next) {
    err.customer = req.decoded;
    // err.localHostname = req.hostname;
    // err.originalUrl = req.originalUrl;
    apiLogger.error(err);
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || err.statusCode || 500);
        res.json({
            error: err
        });
    });
}

// notify developers
app.use(function(err, req, res, next) {
    next(err);
    // TODO: Notify developers
});

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || err.statusCode || 500);
    res.json({
        error: { name: "ERROR", message: "We have encoutered some technical issues. Our team is already notified. We will contact you shortly." }
    });
  
});

//===============Start Server================

http.createServer(app).listen(config.port);
console.log('App is listening at http port %s', config.port);

if(config.ssl) {
    options = {
        key: fs.readFileSync(config.ssl.key),
        cert: fs.readFileSync(config.ssl.cert)
        // requestCert: true,
        // rejectUnauthorized: true
    };

    https.createServer(options, app).listen(config.port+1);
    console.log('App is listening at https port %s', config.port+1);
}

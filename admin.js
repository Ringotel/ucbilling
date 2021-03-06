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
var debug = require('debug')('admin');
var apiLogger = require('./modules/logger').api;
var httpLogger = require('./modules/logger').http;
httpLogger.stream = {
    write: function(message, encoding){
        httpLogger.info(message);
    }
};

app.use(helmet());
app.use(morgan("combined", { stream: httpLogger.stream }));

mongoose.connect(config.bdb, { useMongoClient: true, autoIndex: false });
mongoose.Promise = global.Promise;

// mongoose.connect(config.bdb, config.dbConf);

app.set('views', path.resolve('views'));
app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

app.use(express.static(path.resolve('app')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-type, Content-length');
    next();
});

// Response to preflight requests
app.options("/*", function(req, res, next){
    res.sendStatus(200);
});

app.use('/admin/api', require('./routes/admin'));

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

http.createServer(app).listen(config.adminport);
console.log('App is listening at http adminport %s', config.adminport);

if(config.ssl) {
    options = {
        key: fs.readFileSync(config.ssl.key),
        cert: fs.readFileSync(config.ssl.cert)
        // requestCert: true,
        // rejectUnauthorized: true
    };

    https.createServer(options, app).listen(config.adminport+1);
    console.log('App is listening at https adminport %s', config.adminport+1);
}

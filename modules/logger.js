var config = require('../env/index');
var winston = require('winston');
var mailer = require('./mailer');
var timestampFn = function(){
    return new Date();
};
var errorFormatter = function(options) {
    // Return string will be passed to logger.
    return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') +
      (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' ) +' '+options.stack;
};

var apiLogger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: true,
      timestamp: timestampFn
    }),
    new (winston.transports.File)({
      name: 'system',
      filename: config.logPath+'/system.log',
      level: 'info',
      maxsize: config.logMaxSize,
      tailable: true,
      json: false,
      timestamp: timestampFn
    }),
    new (winston.transports.File)({
      name: 'error',
      filename: config.logPath+'/error.log',
      level: 'error',
      maxsize: config.logMaxSize,
      tailable: true,
      timestamp: timestampFn
    })
  ]
});

var jobsLogger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: true,
      timestamp: timestampFn
    }),
    new (winston.transports.File)({
      name: 'jobs',
      filename: config.logPath+'/jobs.log',
      level: 'info',
      maxsize: config.logMaxSize,
      tailable: true,
      json: false,
      timestamp: timestampFn
    }),
    new (winston.transports.File)({
      name: 'jobsError',
      filename: config.logPath+'/jobs-error.log',
      level: 'error',
      maxsize: config.logMaxSize,
      tailable: true,
      timestamp: timestampFn
    })
  ]
});

winston.handleExceptions(new winston.transports.File({
  filename: config.logPath+'/exceptions.log',
  maxsize: config.logMaxSize,
  tailable: true,
  timestamp: timestampFn
}));

module.exports = {
  api: apiLogger,
  jobs: jobsLogger
};
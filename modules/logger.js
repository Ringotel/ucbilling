var config = require('../env/index');
var winston = require('winston');
// var mailer = require('./mailer');
var timestampFn = function(){
    return new Date();
};
var errorFormatter = function(options) {
    // Return string will be passed to logger.
    return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') +
      (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' ) +' '+options.stack;
};

var httpLogger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: 'debug',
      handleExceptions: true,
      colorize: true,
      json: false
    }),
    new (winston.transports.File)({
      name: 'http',
      filename: config.logPath+'/http.log',
      level: 'info',
      maxsize: config.logMaxSize,
      maxFiles: 5,
      json: true,
      handleExceptions: true,
      timestamp: timestampFn,
      prettyPrint: true
    })
  ],
  exitOnError: false
});

var systemLogger = new (winston.Logger)({
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      colorize: true,
      timestamp: timestampFn,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      name: 'system',
      filename: config.logPath+'/system.log',
      level: 'info',
      maxsize: config.logMaxSize,
      tailable: true,
      json: false,
      timestamp: timestampFn,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      name: 'error',
      filename: config.logPath+'/error.log',
      level: 'error',
      maxsize: config.logMaxSize,
      tailable: true,
      timestamp: timestampFn,
      prettyPrint: true
    })
  ]
});

var mailerLogger = new (winston.Logger)({
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      colorize: true,
      timestamp: timestampFn,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      name: 'mailer',
      filename: config.logPath+'/mailer.log',
      level: 'info',
      maxsize: config.logMaxSize,
      tailable: true,
      json: false,
      timestamp: timestampFn,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      name: 'error',
      filename: config.logPath+'/error.log',
      level: 'error',
      maxsize: config.logMaxSize,
      tailable: true,
      timestamp: timestampFn,
      prettyPrint: true
    })
  ]
});

var apiLogger = new (winston.Logger)({
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      colorize: true,
      timestamp: timestampFn,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      name: 'system',
      filename: config.logPath+'/api.log',
      level: 'info',
      maxsize: config.logMaxSize,
      tailable: true,
      json: false,
      timestamp: timestampFn,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      name: 'error',
      filename: config.logPath+'/error.log',
      level: 'error',
      maxsize: config.logMaxSize,
      tailable: true,
      timestamp: timestampFn,
      prettyPrint: true
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
      timestamp: timestampFn,
      prettyPrint: true
    })
  ]
});

var transactionsLogger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: true,
      timestamp: timestampFn
    }),
    new (winston.transports.File)({
      name: 'transactions',
      filename: config.logPath+'/transactions.log',
      level: 'info',
      maxsize: config.logMaxSize,
      tailable: true,
      json: true,
      timestamp: timestampFn
    }),
    new (winston.transports.File)({
      name: 'transactionsError',
      filename: config.logPath+'/transactions-error.log',
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
  timestamp: timestampFn,
  prettyPrint: true
}));

module.exports = {
  http: httpLogger,
  system: systemLogger,
  mailer: mailerLogger,
  api: apiLogger,
  jobs: jobsLogger,
  transactions: transactionsLogger
};
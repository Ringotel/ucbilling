var config = require('../env/index');
var winston = require('winston');
var timestampFn = function(){ return new Date(); };
var errorFormatter = function(options) {
    // Return string will be passed to logger.
    return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') +
      (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' ) +' '+options.stack;
};
var httpLogger;
var systemLogger;
var mailerLogger;
var apiLogger;
var jobsLogger;
var transactionsLogger;

winston.handleExceptions(new winston.transports.File({
    filename: config.logPath+'/exceptions.log',
    maxsize: config.logMaxSize,
    tailable: true,
    timestamp: timestampFn,
    prettyPrint: true
}));

httpLogger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            colorize: true
        }),
        new winston.transports.File({
            level: 'info',
            filename: config.logPath+'/http.log',
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

systemLogger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            colorize: true,
            timestamp: timestampFn,
            prettyPrint: true
        }),
        new winston.transports.File({
            name: 'info-file',
            level: 'info',
            filename: config.logPath+'/system.log',
            maxsize: config.logMaxSize,
            timestamp: timestampFn,
            tailable: true,
            prettyPrint: true
        }),
        new winston.transports.File({
            name: 'error-file',
            level: 'error',
            filename: config.logPath+'/error.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn,
            prettyPrint: true
        })
    ]
});

mailerLogger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            colorize: true,
            timestamp: timestampFn,
            prettyPrint: true
        }),
        new winston.transports.File({
            name: 'info-file',
            level: 'info',
            filename: config.logPath+'/mailer.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn,
            prettyPrint: true
        }),
        new winston.transports.File({
            name: 'error-file',
            level: 'error',
            filename: config.logPath+'/error.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn,
            prettyPrint: true
        })
    ]
});

apiLogger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            colorize: true,
            timestamp: timestampFn,
            prettyPrint: true
        }),
        new winston.transports.File({
            name: 'info-file',
            level: 'info',
            filename: config.logPath+'/api.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn,
            prettyPrint: true
        }),
        new winston.transports.File({
            name: 'error-file',
            level: 'error',
            filename: config.logPath+'/error.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn,
            prettyPrint: true
        })
    ]
});

jobsLogger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            colorize: true,
            timestamp: timestampFn,
            handleExceptions: true
        }),
        new winston.transports.File({
            name: 'info-file',
            level: 'info',
            filename: config.logPath+'/jobs.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn
        }),
        new winston.transports.File({
            name: 'error-file',
            level: 'error',
            filename: config.logPath+'/jobs-error.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn,
            prettyPrint: true
        })
    ]
});

transactionsLogger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            colorize: true,
            timestamp: timestampFn
        }),
        new winston.transports.File({
            name: 'info-file',
            level: 'info',
            filename: config.logPath+'/transactions.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn
        }),
        new winston.transports.File({
            name: 'error-file',
            level: 'error',
            filename: config.logPath+'/transactions-error.log',
            maxsize: config.logMaxSize,
            tailable: true,
            timestamp: timestampFn
        })
    ]
});

module.exports = {
    http: httpLogger,
    system: systemLogger,
    mailer: mailerLogger,
    api: apiLogger,
    jobs: jobsLogger,
    transactions: transactionsLogger
};
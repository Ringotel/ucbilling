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

winston.add(winston.transports.File, {
  name: 'system',
  level: 'info',
  filename: config.logPath+'/system.log',
  maxsize: config.logMaxSize,
  tailable: true,
  json: false,
  timestamp: timestampFn
});

winston.add(winston.transports.File, {
  name: 'error',
  level: 'error',
  filename: config.logPath+'/error.log',
  maxsize: config.logMaxSize,
  tailable: true,
  json: false,
  timestamp: timestampFn
});

winston.handleExceptions(new winston.transports.File({
  filename: config.logPath+'/exceptions.log',
  maxsize: config.logMaxSize,
  tailable: true,
  timestamp: timestampFn
}));

// var logger = new (winston.Logger)({
//   transports: [
//     new (winston.transports.Console)({
//       handleExceptions: true,
//       json: false
//     }),
//     new (winston.transports.File)({
//       name: 'system',
//       filename: config.logPath+'/system.log',
//       level: 'info',
//       maxsize: config.logMaxSize,
//       tailable: true,
//       json: false,
//       timestamp: timestampFn
//     }),
//     new (winston.transports.File)({
//       name: 'error',
//       filename: config.logPath+'/error.log',
//       level: 'error',
//       maxsize: config.logMaxSize,
//       tailable: true,
//       timestamp: timestampFn
//     })
//   ],
//   exceptionHandlers: [
//     new winston.transports.File({
//         filename: config.logPath+'/exceptions.log',
//         maxsize: config.logMaxSize,
//         tailable: true,
//         timestamp: timestampFn
//     })
//   ]
// });

// logger.on('error', function (err) {
//     var mailerOpts = {
//         from: {
//             name: "Robo Service Support",
//             address: "noreply@smile-soft.com"
//         },
//         to: 'arro@smile-soft.com', //TODO - get email from config
//         subject: "Error notification",
//         html: err
//     };

//     mailer.sendMail(mailerOpts, function (err, result){
//         if(err){
//             return logger.info(err, {user: 'admin'});
//         }
//         logger.info('Email sent to %s, with result %s', mailerOpts.to, result);
//     });
// });

module.exports = winston;
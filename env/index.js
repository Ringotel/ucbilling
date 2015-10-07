module.exports = (function (env) {
  var config = {};
  switch (env) {
    case 'production':
      config = require('../config/production');
      break;
    case 'development':
      config = require('../config/development');
      break;
    case 'testing':
      config = require('../config/testing');
      break;
    case 'staging':
      config = require('../config/staging');
      break;
    default:
      config = require('../config/development');
      // console.error('NODE_ENV environment variable not set');
      // process.exit(1);
  }
  return config;
})(process.env.NODE_ENV);
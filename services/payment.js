var config = require('../env/index');
var Stripe = require('stripe')(config.stripe.token);
var debug = require('debug')('billing');
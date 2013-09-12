/**
 * twitter-proxy
 */

// Grab the config file
var config;
try {
  config = require('./config');
} catch (e) {
  console.error("No config file found.");
  process.exit(1);
}

/**
 * Setup the server
 */

var express = require('express'),
    http = require('http'),
    app = express();

var proxy = require('./proxy');

// Save the config for use later
app.set('config', config);
// All environments
app.set('port', config.port || 7890);
// Logging
app.use(express.logger('dev'));
// gzip
app.use(express.compress());
// Body parsing
app.use(express.json());
app.use(express.urlencoded());
// CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  if (req.method === 'OPTIONS') return res.send(200);
  next();
});

// Express routing
app.use(app.router);

// Set up the routes
proxy.route(app);

/**
 * Get the party started
 */
http
  .createServer(app)
  .listen(app.get('port'), function () {
    console.log('twitter-proxy server ready: http://localhost:' + app.get('port'));
  });
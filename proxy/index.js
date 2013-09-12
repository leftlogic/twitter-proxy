/**
 * twitter-proxy
 */

// Dependencies
var oauth = require('oauth'),
    url = require('url'),
    _ = require('lodash');

var oauthCache = null;

/**
 * Constructs an OAuth request object that can then be used with a token and
 * token secret to proxy request to Twitter.
 *
 * Parameters:
 *   {object} client Contains consumerKey & consumerSecret
 */
exports.constructOa = function (client) {
  return new oauth.OAuth(
    'https://api.twitter.com/oauth/request_token',
    'https://api.twitter.com/oauth/access_token',
    client.consumerKey,
    client.consumerSecret,
    '1.0A',
    null,
    'HMAC-SHA1'
  );
};

/**
 * Proxy the request to this API over to Twitter, wrapping it all up in a lovely
 * OAuth1.0A package. The Twitter API credentials are stored in the client
 * object.
 *
 * Parameters:
 *   {string} opts.method  HTTP method, and name of method on the OAuth object
 *   {string} opts.path    Twitter API URL path
 *   {object} opts.config  Keys: accessToken and accessTokenSecret
 *   {object} opts.req     An express request object
 *   {object} opts.client  A document from the client collection, used to
 *                         construct an OAuth request object.
 *   {function} cb         Callback function for when the request is complete.
 *                         Takes an error, the response as a string and the full
 *                         response object.
 */
exports.proxyRequest = function (opts, cb) {
  // Pull the oa object from the in-memory cache, or create a new one.
  var oa = oauthCache || exports.constructOa(opts.client);
  oauthCache = oa;

  // Make sure the the oa object has the requisite method
  var method = opts.method.toLowerCase();
  if (!oa[method]) return cb(new Error("Unknown method"));

  var twitterUrl = url.format({
    protocol: 'https',
    host: 'api.twitter.com',
    pathname: opts.path,
    query: opts.req.query
  });

  return oa[method](
    twitterUrl,
    opts.config.accessToken,
    opts.config.accessTokenSecret,
    cb
  );
};

/**
 * Filter out unwanted information from a headers object.
 */
exports.filterHeaders = function (headers) {
  var reject = ['content-length', 'content-type'];
  return Object.keys(headers).reduce(function (memo, key){
    if (!_.contains(reject, key)) {
      memo[key] = headers[key];
    }
    return memo;
  }, {});
};


exports.route = function (app) {

  /**
   * Proxy requests to all other URLs to Twitter, using the same path. It also
   * passes all query parameters, except those used by the proxy, on to Twitter.
   */
  app.all('/*?',
    function (req, res, next) {
      var config = app.get('config'),
          proxyConfig = {
            accessToken: config.accessToken,
            accessTokenSecret: config.accessTokenSecret
          },
          client = {
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret
          };

      // Prozy the request onward to Twitter. The OAuth parcel is created in
      // proxyRequest, and cached for later.
      // method, path, config, req, client
      exports.proxyRequest({
        req: req,
        method: req.method,
        path: req.path,
        config: proxyConfig,
        client: client
      }, function (oaErr, strData, oaRes) {
        // Merge headers in, but don't overwrite any existing headers
        if (oaRes.headers) {
          res.set(_.defaults({}, res._headers, exports.filterHeaders(oaRes.headers)));
        }

        var data = strData;

        // Uh oh, errortime.
        if (oaErr) {
          // Intercept a Twitter error
          data = oaErr.data;
          try {
            data = JSON.parse(oaErr.data);
          } catch (e) {}
        }

        // Try to extract JSON data
        try {
          data = JSON.parse(strData);
        } catch(e) {}

        // Pass on data with the same the status code
        res.send(oaRes.statusCode, data);
      });
    });

};
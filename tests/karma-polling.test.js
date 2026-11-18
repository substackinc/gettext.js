// start the karma server from tests/karma.config.dev.js (without browsers),
// open an Engine.IO v4 polling session and send it a binary POST.
// The server must answer it instead of leaving the connection open.
var http = require('http');
var path = require('path');
var karma = require('karma');

var PORT = 9877;
var TIMEOUT = 3000;

function request(options, body) {
    return new Promise(function (resolve, reject) {
        var req = http.request(Object.assign({ host: '127.0.0.1', port: PORT, agent: false }, options), function (res) {
            var data = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) { data += chunk; });
            res.on('end', function () { resolve({ status: res.statusCode, body: data }); });
        });
        req.setTimeout(TIMEOUT, function () {
            req.destroy(new Error('no response from ' + options.method + ' ' + options.path + ' within ' + TIMEOUT + 'ms'));
        });
        req.on('error', reject);
        req.end(body);
    });
}

function finish(server, ok, message) {
    console.log(message);
    process.exitCode = ok ? 0 : 1;
    server.stop().catch(function () {}).then(function () { process.exit(process.exitCode); });
}

karma.config.parseConfig(path.join(__dirname, 'karma.config.dev.js'), {
    port: PORT,
    browsers: [],
    autoWatch: false,
    singleRun: false,
    logLevel: 'OFF',
    plugins: ['karma-mocha', 'karma-sinon-expect']
}, { promiseConfig: true, throwErrors: true }).then(function (config) {
    var server = new karma.Server(config);

    server.on('listening', function () {
        var base = config.urlRoot + 'socket.io/?EIO=4&transport=polling';

        request({ method: 'GET', path: base }).then(function (handshake) {
            var sid = JSON.parse(handshake.body.slice(handshake.body.indexOf('{'))).sid;
            return request({
                method: 'POST',
                path: base + '&sid=' + sid,
                headers: { 'Content-Type': 'application/octet-stream' }
            }, Buffer.from([1, 2, 3]));
        }).then(function (res) {
            finish(server, true, 'binary polling POST was answered with status ' + res.status);
        }, function (err) {
            finish(server, false, 'binary polling POST was not answered: ' + err.message);
        });
    });

    server.start();
}).catch(function (err) {
    console.error(err);
    process.exit(1);
});

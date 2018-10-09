
var Proxy = require('http-mitm-proxy');

var fs = require('fs');
var net = require('net');
var url = require('url');
var http = require('http');
var process = require('process');


const ENABLE_INJECTION = true;
const PROXY_PORT = 8081;
var proxy = Proxy();



function override(object, methodName, callback)
{
    object[methodName] = callback(object[methodName]);
}


// Monkey patch node-http-mitm-proxy.Proxy._onHttpServerConnect()
// to avoid ECONNRESET unhandled exception
override(proxy, '_onHttpServerConnect', function(original) {
    return function(req, socket, head) {
        socket.addListener("error", (err) => {
            console.log("**** _onHttpServerConnect: socket error", err);
        });
        return original.apply(this, arguments);
    };
});


function onError(ctx, err, errorKind)
{
    const url = (ctx && ctx.clientToProxyRequest) ?
        ctx.clientToProxyRequest.url : "n/a";
    console.error("**** " + errorKind + ' on ' + url + ':', err);
}

/**
 * handle request header from server
 *
 */
function onRequest(ctx, callback)
{
    ctx.doInjection = false;
    ctx.injectionStarted = false;

    // !!!! we prevent response from being compressed
    ctx.proxyToServerRequestOptions.headers['accept-encoding'] = 'identity';
    return callback();
}


/**
 * handle response header from server
 *
 */
function onResponse(ctx, callback)
{
    const resp_headers = ctx.serverToProxyResponse.headers;
    const req_headers = ctx.clientToProxyRequest.headers;

    // !!!! here we remove the csp header
    delete resp_headers['content-security-policy'];

    /* The Expect-CT header allows sites to opt in to reporting
     * and/or enforcement of Certificate Transparency
     * requirements, which prevents the use of misissued
     * certificates for that site from going unnoticed.
     */
    delete resp_headers['expect-ct'];

    if (resp_headers['content-type'] &&
        resp_headers['content-type'].startsWith('text/html') &&
        ! ('x-requested-with' in req_headers))
    {
        ctx.doInjection = ENABLE_INJECTION;
    }
    else
    {
        ctx.doInjection = false;
    }
    return callback();
}


/**
 * handle response data from server
 *
 * @param chunk is object Uint8Array
 */
function onResponseData(ctx, chunk, callback)
{
    if (!ctx.doInjection)
    {
        return callback(null, chunk);
    }

    if (ctx.injectionStarted)
    {
        return callback(null, chunk);
    }

    const resp_headers = ctx.serverToProxyResponse.headers;
    const resp_encoding = resp_headers["content-encoding"];
    const compressed = (resp_encoding && resp_encoding.toLowerCase() == "gzip");

    if (compressed)
    {
        ctx.use(Proxy.gunzip);
    }

    ctx.proxyToClientResponse.write(chunk);
    ctx.injectionStarted = true;

    return callback(null, null);
}


function onResponseEnd(ctx, callback)
{
    if (ctx.serverToProxyResponse.headers['transfer-encoding'] != 'chunked')
    {
        console.log(ctx.serverToProxyResponse);
        console.log(ctx.clientToProxyRequest);
        //??????
        console.log("******* throw 0");
        throw 0;
    }

    return callback();
}



proxy.onError(onError);
proxy.onRequest(onRequest);
// proxy.onRequestData();
// proxy.onRequestEnd()
proxy.onResponse(onResponse);
proxy.onResponseData(onResponseData);
proxy.onResponseEnd(onResponseEnd);

proxy.listen({
    port: PROXY_PORT,
    silent:false
});

console.log("Proxy port: ", PROXY_PORT);
const ca = fs.readFileSync(proxy.sslCaDir + '/certs/ca.pem', {encoding: "ascii"});
console.log("Make sure your browser trusts this CA:", ca);

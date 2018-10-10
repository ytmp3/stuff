"use strict";

const replaceStream = require('replacestream');
const Proxy = require('http-mitm-proxy');

const fs = require('fs');
const net = require('net');
const url = require('url');
const http = require('http');
const process = require('process');


const ENABLE_INJECTION = true;
const ENABLE_COMPRESSION = false;
const PROXY_PORT = 8081;

const proxy = Proxy();



/*
note:
 - clientToProxyRequest: IncomingMessage
 - proxyToClientResponse: ServerResponse
 - proxyToServerRequest: ClientRequest
 - serverToProxyResponse: IncomingMessage
*/


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
    const host = ctx.clientToProxyRequest.headers["host"];
    if (host && host.startsWith("www.forcepoint.com")){
        if (ctx.clientToProxyRequest.url == "/blockpage_poc/clientpoc.js"){
            ctx.proxyToClientResponse.writeHead(200, {
                'Content-Type': 'application/javascript'});
            const content = fs.readFileSync("clientpoc.js");
            ctx.proxyToClientResponse.end(content);
            return null;
        }
    }

    if (ENABLE_COMPRESSION){
        ctx.use(Proxy.gunzip);
    }else{
        ctx.proxyToServerRequestOptions.headers['accept-encoding'] = 'identity';
    }
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

    // !!!! todo: for now we remove the csp header
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
        const repl = replaceStream('<head>', '<head>\n<script src="https://www.forcepoint.com/blockpage_poc/clientpoc.js"></script>');
        ctx.addResponseFilter(repl);

        console.log(resp_headers['content-length']);
        // console.log(resp_headers);
        delete resp_headers['content-length'];
    }
    return callback();
}



proxy.onError(onError);
proxy.onRequest(onRequest);
proxy.onResponse(onResponse);

proxy.listen({
    port: PROXY_PORT,
    silent:false
});

console.log("Proxy port: ", PROXY_PORT);
const ca = fs.readFileSync(proxy.sslCaDir + '/certs/ca.pem', {encoding: "ascii"});
console.log("Make sure your browser trusts this CA:", ca);

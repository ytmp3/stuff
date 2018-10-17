"use strict";

const fs      = require('fs');
const net     = require('net');
const url     = require('url');
const http    = require('http');
const process = require('process');
const Proxy   = require('http-mitm-proxy');
const Base64encode = require('base64-stream').encode;


/* cdn to load the 'pako' compression library */
const PAKO_CDN_URL = 'https://cdnjs.cloudflare.com'+
      '/ajax/libs/pako/1.0.6/pako_inflate.min.js';

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


/**
 * build injected template
 *
 * args = {inline_js: '', compressed: true}
 */
function build_template_pre(args){
    let pre_data=`<!DOCTYPE html>
<html>
   <head>
     <script src="${PAKO_CDN_URL}"></script>
     <script type="text/javascript">
      var compressed=${args.compressed};
      var page_content="`;

    return pre_data;
}

function build_template_post(args){
    var post_data=`";
    ${args.inline_js}
    </script>
  </head>
  <body>THIS IS THE INJECTED PAGE</body>
</html>`;
    return post_data;
}

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
    // true if javascript injection must be performed on this request
    // (current criteria is: content-type is text/html
    ctx.doInjection = false;
    ctx.injectionStarted = false;

    if (!ENABLE_COMPRESSION){
        const svr_req_headers = ctx.proxyToServerRequestOptions.headers;
        svr_req_headers['accept-encoding'] = 'identity';
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
        ctx.doInjection = ENABLE_INJECTION;
        delete resp_headers['content-length'];
    }
    return callback();
}


/**
 * handle response data from server
 *
 */
function onResponseData(ctx, chunk, callback)
{
    if (!ctx.doInjection){
        return callback(null, chunk);
    }

    if (!ctx.injectionStarted){
        const resp_headers = ctx.serverToProxyResponse.headers;
        const resp_encoding = resp_headers["content-encoding"];
        const compressed = (resp_encoding == "gzip");

        if (compressed)
        {
            ctx.use(Proxy.gunzip);
        }

        const pre_data = build_template_pre({compressed});
        ctx.proxyToClientResponse.write(pre_data);
        ctx.injectionStarted = true;

        ctx.b64encoder = new Base64encode();
        ctx.b64encoder.pipe(ctx.proxyToClientResponse);
    }
    ctx.b64encoder.write(chunk);
    return callback(null, null);
}

/**
 * handle response end from server
 *
 */
function onResponseEnd(ctx, callback)
{
    const resp_headers = ctx.serverToProxyResponse.headers;
    if (resp_headers['transfer-encoding'] != 'chunked'){
        console.log('onResponseEnd:!!!!!!!!!!!!!!!!');
        throw 0;
    }

    if (ctx.doInjection)
    {
        const inline_js = fs.readFileSync("injected_page.js", "utf8");;
        const post_data = build_template_post({inline_js});
        ctx.proxyToClientResponse.write(post_data);
    }

    return callback();
}


proxy.onError(onError);
proxy.onRequest(onRequest);
proxy.onResponse(onResponse);
proxy.onResponseData(onResponseData);
proxy.onResponseEnd(onResponseEnd);



proxy.listen({
    port: PROXY_PORT,
    silent:false
});

const ca_path = proxy.sslCaDir + '/certs/ca.pem';
// const ca = fs.readFileSync(ca_path, {encoding: "ascii"});
console.log("Make sure your browser trusts this CA:");
console.log(ca_path);
console.log("Proxy running on port", PROXY_PORT);

"use strict";

const fs      = require('fs');
const net     = require('net');
const url     = require('url');
const http    = require('http');
const process = require('process');
const Proxy   = require('http-mitm-proxy');
const Base64encode = require('base64-stream').encode;
const { Transform } = require('stream');

/* cdn to load the 'pako' compression library */
const PAKO_CDN_URL = 'https://cdnjs.cloudflare.com'+
      '/ajax/libs/pako/1.0.6/pako_inflate.min.js';

const ENABLE_INJECTION = true;
const ENABLE_COMPRESSION = false;
const PROXY_PORT = 8081;

const proxy = Proxy();
var context_count = 0;


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
 * build injected template (begin)
 *
 * args = {compressed: true}
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

/**
 * build injected template (end)
 *
 * args = {inline_js: '...'}
 */
function build_template_post(args){
    var post_data=`";
    ${args.inline_js}
    </script>
  </head>
  <body>THIS IS THE INJECTED PAGE</body>
</html>`;
    return post_data;
}


class AddStubAndBase64 extends Base64encode {
    constructor(options) {
        super(options);
        this.injectionStarted = false;
    }

    _transform(chunk, encoding, callback){
        console.log("in _transform");

        if (!this.injectionStarted){
            let compressed = false;
            const pre_data = build_template_pre({compressed});
            this.push(pre_data);
            this.injectionStarted = true;
        }
        super._transform(chunk, encoding, callback);
    }

    _flush(callback){
        console.log("in _flush");
        super._flush(()=>{
            const inline_js = fs.readFileSync("injected_page.js", "utf8");;
            const post_data = build_template_post({inline_js});
            this.push(post_data);
            callback();
        });
    }
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
    ctx.contextid = ++context_count;

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

    const must_inject = (
        ENABLE_INJECTION &&
        resp_headers['content-type'] &&
            resp_headers['content-type'].startsWith('text/html') &&
            ! ('x-requested-with' in req_headers));

    if (must_inject){
        delete resp_headers['content-length'];
        const myfilt = new AddStubAndBase64();
        ctx.addResponseFilter(myfilt);
    }

    return callback();
}


/**
 * handle response data from server
 *
 */
function onResponseData(ctx, chunk, callback)
{
    return callback(null, chunk);

}

/**
 * handle response end from server
 *
 */
function onResponseEnd(ctx, callback)
{
    console.log("in onResponseEnd", ctx.contextid);

    const resp_headers = ctx.serverToProxyResponse.headers;
    if (resp_headers['transfer-encoding'] != 'chunked'){
        console.log('onResponseEnd:!!!!!!!!!!!!!!!!');
        throw 0;
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

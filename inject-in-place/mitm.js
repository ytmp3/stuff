"use strict";

var Policy = require('csp-parse');
const mime = require('mime');
const Proxy = require('http-mitm-proxy');

const fs = require('fs');
const net = require('net');
const http = require('http');


const ENABLE_INJECTION = true;
const ENABLE_COMPRESSION = false;
const PROXY_PORT = 8081;

// const INJECTED_SCRIPT = "https://s3.eu-central-1.amazonaws.com/forcepoint-ngfw-web/clientpoc.js";
const INJECTED_SCRIPT = "https://www.forcepoint.com/blockpage_poc/fpbp.js";

const INJECTED_DATA = `<!DOCTYPE html><script id="__fp_bp_is" data-interval_mn="1" src="${INJECTED_SCRIPT}"></script>\n`;

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
            console.log("**** _onHttpServerConnect: socket error", err.errno);
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

    const fullUrl = '//' + host + ctx.clientToProxyRequest.url;
    // console.log("onRequest: ", fullUrl);

    const isFakeServer = fullUrl.startsWith("//www.example.com");

    if (isFakeServer || fullUrl.startsWith("//www.forcepoint.com/blockpage_poc")){
        const url = ctx.clientToProxyRequest.url;
        const ext = url.split('.').pop();
        const fname = url.split('/').pop();
        const mimeType = mime.getType(ext);

        const headers = {
            'Content-Type': mimeType
        };


        let responseCode = 200;
        let content = "";
        try{
            content = fs.readFileSync(fname);
        } catch (err) {
            responseCode = 404;
            content=`error 404 ${fname} not found`;
        }

        if (isFakeServer){
            // const INJECTED_DATA2 =
            //     '<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="script-src https://www.forcepoint.com"/><script src="https://www.forcepoint.com/blockpage_poc/clientpoc.js"></script>\n';

            headers["Content-Security-Policy"] = ["script-src 'self' https://code.jquery.com 'sha256-GoCTp92A/44wB06emgkrv9wmZJA7kgX/VK3D+9jr/Pw='", "script-src https://www.forcepoint.com"];


            // if (mimeType.startsWith('text/html')){
            //     content = INJECTED_DATA2 + content;
            // }
        }

        ctx.proxyToClientResponse.writeHead(responseCode, headers);
        ctx.proxyToClientResponse.end(content);
        return null;
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
    // delete resp_headers['content-security-policy'];

    /* The Expect-CT header allows sites to opt in to reporting
     * and/or enforcement of Certificate Transparency
     * requirements, which prevents the use of misissued
     * certificates for that site from going unnoticed.
     */
    delete resp_headers['expect-ct'];

    // note: headers converted to lowercase by nodejs
    const is_html = 'content-type' in resp_headers &&
          resp_headers['content-type'].startsWith('text/html');
    const is_xhr = ('x-requested-with' in req_headers);
    const is_cors = ('origin' in req_headers);

    ctx.must_inject = (ENABLE_INJECTION && is_html && !is_xhr && !is_cors);


    if (ctx.must_inject)
    {
        delete resp_headers['content-length'];
        const csp = resp_headers['content-security-policy'];
        if (csp){
            const policy = new Policy(csp);
            const script = policy.get('script-src');
            if (script){
                const url = new URL(INJECTED_SCRIPT);
                policy.add('script-src', url.origin);
                const modified_csp = policy.toString();
                console.log("### modified csp: %s", modified_csp);
                resp_headers['content-security-policy'] = modified_csp;
            }
        }
    }
    return callback();
}

function onResponseData(ctx, chunk, callback){
    if (ctx.must_inject && !ctx.injection_done){
        ctx.injection_done = true;
        chunk = new Buffer(INJECTED_DATA + chunk.toString());
    }
    return callback(null, chunk);
}


proxy.onError(onError);
proxy.onRequest(onRequest);
proxy.onResponse(onResponse);
proxy.onResponseData(onResponseData);

proxy.listen({
    port: PROXY_PORT,
    silent:false
});


const ca_path = proxy.sslCaDir + '/certs/ca.pem';
// const ca = fs.readFileSync(ca_path, {encoding: "ascii"});
console.log("Make sure your browser trusts this CA:");
console.log(ca_path);
console.log("Proxy running on port", PROXY_PORT);

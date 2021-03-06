"use strict";

const Policy = require('./csp-parse');
const crypto = require('crypto');
const mime = require('mime');
const Proxy = require('http-mitm-proxy');
const url = require('url');

const process = require('process');
const fs = require('fs');
const net = require('net');
const http = require('http');

const ENABLE_INJECTION = true;
const ENABLE_COMPRESSION = false;
const PROXY_PORT = 8081;


const DEFAULT_CATEGORY='gambling';
const DEFAULT_INTERVAL_SEC=10;


const SHARED_STORE_IFRAME_URL = "https://www.forcepoint.com/blockpage_poc/fpbpstore-src.html";
// const SHARED_STORE_IFRAME_URL = "";

const DEFAULT_OVERLAY_CONTENT = `
<html>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <body>
    <div>
       ACCESS TO THIS PAGE IS BLOCKED FOR {{interval_sec}} seconds (CORPORATE POLICY)
       <br/>
       category: {{category}}
    </div>
    <button id="__fp_overlay_allow">Access anyway</button>
    <button id="__fp_overlay_back">Go back</button>
  </body>
</html>`;

// 'url' or 'content'
// const INJECTION_METHOD = 'content';
const INJECTION_METHOD = 'content';

// const INJECTED_SCRIPT_URL = "https://s3.eu-central-1.amazonaws.com/forcepoint-ngfw-web/clientpoc.js";
const INJECTED_SCRIPT_URL = "https://www.forcepoint.com/blockpage_poc/fpbp.js";

const inDevelopmentMode = (process.env.Node_ENV === "development");

// set the following variable to inject the src script instead of the
// uglified one:
// export Node_ENV=development
const INJECTED_SCRIPT = __dirname +
      (inDevelopmentMode ? "/fpbp-src.js" : "/fpbp.js");

console.log("Injecting %s", INJECTED_SCRIPT);

var g_injected_content = null;
var g_injected_hash = null;


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


function getCspHash(data){
    const hash = crypto.createHash('sha256');
    const h = hash.update(data);
    const sha256buffer = hash.digest(h);
    const sha256base64 = Buffer.from(sha256buffer).toString('base64');
    return 'sha256-' + sha256base64;
}



function getInjectedContent(){
    // if (!g_injected_content){
    //     g_injected_content = fs.readFileSync(INJECTED_SCRIPT);
    // }
    // return g_injected_content;
    g_injected_content = fs.readFileSync(INJECTED_SCRIPT);
    return g_injected_content;
}

function getInjectedHash(){
    if (!g_injected_hash){
        const content = getInjectedContent();
        g_injected_hash = getCspHash(content);
    }
    return g_injected_hash;
}


function getInjectedData(){
    const category = DEFAULT_CATEGORY;
    const overlay_content = Buffer.from(DEFAULT_OVERLAY_CONTENT).toString('base64');
    const interval_sec = DEFAULT_INTERVAL_SEC;

    if (INJECTION_METHOD === 'url'){
        const INJECTED_URL_DATA = `<!DOCTYPE html><script id="__fp_bp_is" data-interval_sec="${interval_sec}" src="${INJECTED_SCRIPT_URL}" data-content="${overlay_content}" data-category="${category}"></script>\n`;
        return INJECTED_URL_DATA;
    }else{
        const content = getInjectedContent();
        const INJECTED_SCRIPT_DATA = `<!DOCTYPE html><script  id="__fp_bp_is" data-interval_sec="${interval_sec}" data-content="${overlay_content}" data-category="${category}" data-shared_domain_url="${SHARED_STORE_IFRAME_URL}">${content}</script>\n`;
        return INJECTED_SCRIPT_DATA;

    }
}


/**
 * handle request header from browser
 *
 */
function onRequest(ctx, callback)
{
    if (/[\?\&]x-fp-bp-xhr$/.test(ctx.clientToProxyRequest.url)){
        const param_len="x-fp-bp-xhr".length +1;
        ctx.clientToProxyRequest.url =
            ctx.clientToProxyRequest.url.slice(0, -param_len);
        console.log("sliced url=%s", ctx.clientToProxyRequest.url);
        ctx.no_inject = true;
    }

    const headers = ctx.clientToProxyRequest.headers;
    const host = headers["host"];
    const fullUrl = '//' + host + ctx.clientToProxyRequest.url;


    const isFakeServer = fullUrl.startsWith("//www.example.com");

    if (isFakeServer || fullUrl.startsWith("//www.forcepoint.com/blockpage_poc")){
        const url = ctx.clientToProxyRequest.url;
        const ext = url.split('.').pop();
        const fname = url.split('/').pop();
        const mimeType = mime.getType(ext);

        const headers = {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*'
        };


        let responseCode = 200;
        let content = "";
        try{
            console.log("reading file '%s'", fname);
            content = fs.readFileSync(fname);
        } catch (err) {
            responseCode = 404;
            content=`error 404 ${fname} not found`;
        }

        if (isFakeServer){
            // const INJECTED_URL_DATA2 =
            //     '<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="script-src https://www.forcepoint.com"/><script src="https://www.forcepoint.com/blockpage_poc/clientpoc.js"></script>\n';

            headers["Content-Security-Policy"] = ["script-src 'self' https://code.jquery.com 'sha256-GoCTp92A/44wB06emgkrv9wmZJA7kgX/VK3D+9jr/Pw='", "script-src https://www.forcepoint.com"];

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

    ctx.must_inject = (ENABLE_INJECTION && is_html && !ctx.no_inject &&
                       !is_xhr && !is_cors);


    if (ctx.must_inject)
    {
        delete resp_headers['content-length'];
        const csp = resp_headers['content-security-policy'];
        const default_csp = csp;

        delete resp_headers['etag'];
        delete resp_headers['last-modified'];

        if (csp){
            const policy = new Policy(csp);
            const script_src = policy.get('script-src');
            const frm_src = policy.get('frame-src');
            const default_src = policy.get('default-src');

            // inject script as inline content
            if (SHARED_STORE_IFRAME_URL.length){
                const ifr_url = new URL(SHARED_STORE_IFRAME_URL);

                if (!frm_src && default_src){
                    policy.set('frame-src', default_src);
                }
                policy.add('frame-src', ifr_url.origin);
            }

            let script_inject_data;
            if (INJECTION_METHOD === 'url'){
                const url = new URL(INJECTED_SCRIPT_URL);
                script_inject_data = url.origin;
            }else{
                //
                const sha256 = getInjectedHash();
                script_inject_data = "'"+sha256+"'";
            }


            if (!script_src && default_src){
                policy.set('script-src', default_src);
            }
            policy.add('script-src', script_inject_data);

            let modified_csp = policy.toString();
            console.log("\n\n### orig csp: %s", default_csp);
            console.log("### modified csp: %s", modified_csp);
            resp_headers['content-security-policy'] = modified_csp;
        }//end if csp
    }// end if must_inject
    return callback();
}

function onResponseData(ctx, chunk, callback){
    if (ctx.must_inject && !ctx.injection_done){
        ctx.injection_done = true;

        const injected_data = getInjectedData();
        chunk = new Buffer(injected_data + chunk.toString());
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

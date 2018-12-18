"use strict";

const Policy = require('./csp-parse');
const crypto = require('crypto');
const mime = require('mime');
const Proxy = require('http-mitm-proxy');

const process = require('process');
const fs = require('fs');
const net = require('net');
const http = require('http');

const ENABLE_INJECTION = true;
const ENABLE_COMPRESSION = false;
const PROXY_PORT = 8081;


const DEFAULT_CATEGORY='gambling';
const DEFAULT_INTERVAL_SEC=10;


// const SHARED_STORE_IFRAME_URL = "https://www.forcepoint.com/blockpage_poc/fpbpstore-src.html";
const SHARED_STORE_IFRAME_URL = "";

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
        const INJECTED_SCRIPT_DATA = `<!DOCTYPE html><script id="__fp_bp_is" data-interval_sec="${interval_sec}" data-content="${overlay_content}" data-category="${category}" data-shared_domain_url="${SHARED_STORE_IFRAME_URL}">${content}</script>\n`;
        return INJECTED_SCRIPT_DATA;

    }
}


/**
 * handle request header from server
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


    // if ("x-fp-bp-no-inject" in headers){
    //     console.log("!!!!!!!!!!!!!! found NO INJECT for %s", fullUrl);
    //     delete headers["x-fp-bp-no-inject"];
    //     ctx.no_inject = true;
    // }

    if ("access-control-request-headers" in headers){
        const acl_hdr = headers["access-control-request-headers"];
        console.log("found access-control-request-headers: %s", acl_hdr);

        const new_acl_hdr = acl_hdr.split(/,\s*/).
              filter( (e, i)=>{ return e!=="x-fp-bp-no-inject"; }).
              join(",");

        headers["access-control-request-headers"] = new_acl_hdr;
        console.log("rewrite access-control-request-headers: %s", new_acl_hdr);
    }

    // console.log("onRequest: ", fullUrl);

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


            // if (mimeType.startsWith('text/html')){
            //     content = INJECTED_URL_DATA2 + content;
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

    // for cors preflight response, note that this header can also be
    // present even if this is not a preflight OPTIONS message and not
    // event a cors (example regular request to
    // https://www.wikipedia.org/), but I think this is safe to always add the
    // access-control-allow-headers
    if ('access-control-allow-origin' in resp_headers){
        if ('access-control-allow-headers' in resp_headers){
            resp_headers['access-control-allow-headers'] += ",x-fp-bp-no-inject";
        }else{
            resp_headers['access-control-allow-headers'] = "x-fp-bp-no-inject";
        }
        console.log("fix cors acl hdr: %s", resp_headers['access-control-allow-headers']);
    }


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

        delete resp_headers['etag'];
        delete resp_headers['last-modified'];
        if (csp){
            const policy = new Policy(csp);
            const script = policy.get('script-src');
            if (script){
                if (INJECTION_METHOD === 'url'){
                    const url = new URL(INJECTED_SCRIPT_URL);
                    policy.add('script-src', url.origin);
                    const modified_csp = policy.toString();
                    console.log("\n\n### orig csp: %s", csp);
                    console.log("### modified csp: %s", modified_csp);
                    resp_headers['content-security-policy'] = modified_csp;
                }else{
                    if (script.indexOf('unsafe-inline') == -1){
                        const sha256 = getInjectedHash();
                        policy.add('script-src', "'"+sha256+"'");
                        const modified_csp = policy.toString();
                        console.log("\n\n### orig csp: %s", csp);
                        console.log("### modified csp: %s", modified_csp);
                        resp_headers['content-security-policy'] = modified_csp;
                    }
                    // resp_headers['content-security-policy'] = csp;
                }
            }
        }
    }
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

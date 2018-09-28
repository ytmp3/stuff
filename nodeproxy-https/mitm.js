
var Proxy = require('http-mitm-proxy');

var fs = require('fs');
var net = require('net');
var url = require('url');
var http = require('http');
var process = require('process');
var Base64encode = require('base64-stream').encode;

/* cdn to load the 'pako' compression library */
const PAKO_CDN_URL =
        'https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.6/pako_inflate.min.js';

const DISABLE_COMPRESSION = true;

/**
 * build injected template
 *
 * args = {inline_js: '', compressed: true}
 */
function build_template_pre(args){
    let pre_data=`<!DOCTYPE html>
<html>
   <head>
     <meta charset="utf-8"/>
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

function override(object, methodName, callback)
{
  object[methodName] = callback(object[methodName])
}

var proxy = Proxy();

// Monkey patch node-http-mitm-proxy.Proxy._onHttpServerConnect()
// to avoid ECONNRESET unhandled exception
override(proxy, '_onHttpServerConnect', function(original) {
  return function(req, socket, head) {
    socket.addListener("error", (err) =>
    {
      console.log("onProxyReceiveConnect: socket error");
    });
    return original.apply(this, arguments)
  }
});

proxy.onError(function(ctx, err)
{
    console.error('proxy error:', err);
});

proxy.onRequest(function(ctx, callback)
{
  let b64encoder = new Base64encode();
  b64encoder.pipe(ctx.proxyToClientResponse);

  let enableInjection = false;

  let doInjection = false;
  let injectionStarted = false;

  ctx.proxyToServerRequestOptions.headers['accept-encoding'] = 'identity';

  ctx.onResponse(function(ctx, callback)
  {
    delete ctx.serverToProxyResponse.headers['content-security-policy'];

    if (ctx.serverToProxyResponse.headers['content-type'] &&
        ctx.serverToProxyResponse.headers['content-type'].startsWith('text/html'))
    {
        doInjection = enableInjection;
    }
    else
    {
       doInjection = false;
    }
    callback();
  });

  ctx.onResponseData(function(ctx, chunk, callback)
  {
    if (doInjection) // Perform injection
    {
      if (!injectionStarted)
      {
        //console.log(ctx.serverToProxyResponse.headers);
        let resp_encoding = ctx.serverToProxyResponse.headers["content-encoding"];

        let compressed = (resp_encoding == "gzip");
        let pre_data = build_template_pre({ compressed });
        if (compressed)
        {
          ctx.use(Proxy.gunzip);
        }

        ctx.proxyToClientResponse.write(pre_data);
        injectionStarted = true;
      }
      b64encoder.write(chunk);
      callback(null, null);
    }
    else // or not
    {
      callback(null, chunk);
    }
  });

  //console.log(ctx.clientToProxyRequest.headers);
  //console.log(ctx.clientToProxyRequest.url);

  ctx.onResponseEnd(function(ctx, callback)
  {
    if (ctx.serverToProxyResponse.headers['transfer-encoding'] != 'chunked')
    {
      console.log(ctx.serverToProxyResponse);
      console.log(ctx.clientToProxyRequest);
      throw 0;
    }

    if (doInjection)
    {
      let inline_js = fs.readFileSync("injected_page.js", "utf8");;
      let post_data = build_template_post({inline_js});

      ctx.proxyToClientResponse.write(post_data);
    }

    return callback();
  });

  return callback();
});

proxy.listen({ port: 8081 });

console.log("Make sure your browser trusts this CA:");
require('fs').readFile(
  proxy.sslCaDir + '/certs/ca.pem',
  function(err, buf)
  {
    process.stdout.write(buf);
  });


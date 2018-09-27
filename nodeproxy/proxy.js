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
   <meta charset="utf-8"/>
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

/**
 * handle client request
 */
function onProxyReceiveRequest(client_request, client_response){
    console.log("=========================================================");
    console.log("===> got request from browser");
    console.log(client_request.headers['host']);
    console.log(client_request.url);

    let parsedUrl = url.parse(client_request.url);
    // console.log("pathname=", parsedUrl.pathname);
    // console.log("search=", parsedUrl.search);

    let path = (parsedUrl.search != null)?
        parsedUrl.pathname + parsedUrl.search :
        parsedUrl.pathname;

    console.log("hostname=", parsedUrl.hostname);

    let must_inject = false;
    let pre_injected = false;
    let resp_encoding = null;

    // prevent compression of the server response
    if (DISABLE_COMPRESSION){
        client_request.headers["Accept-Encoding"] = "identity";
    }

    let options = {
        host: parsedUrl.hostname,
        port: parsedUrl.port,
        method: client_request.method,
        headers: client_request.headers,
        path: path
    };

    console.log(options.path);

    /**
     * relay response received from server back to the client.
     *
     * perform script injection and encode to base64 the received
     * chunk into a js letiable.
     */
    let onServerResponse = function (server_response) {
        let b64encoder = new Base64encode();
        b64encoder.pipe(client_response);

        server_response.addListener('data', (chunk)=>{
            console.log("got server data");

            if (must_inject){
                let compressed = (resp_encoding=="gzip");
                if (!pre_injected){
                    let pre_data = build_template_pre({compressed});
                    client_response.write(pre_data);
                    pre_injected = true;
                }
                b64encoder.write(chunk);
            }
            else{
                client_response.write(chunk, 'binary');
            }
        });

        server_response.addListener('end', ()=>{
            console.log("got server end");
            if (must_inject){
                let inline_js = fs.readFileSync("injected_page.js","utf8");;
                let post_data = build_template_post({inline_js});
                client_response.end(post_data);
            }else{
                client_response.end();
            }
        });

        console.log("===> got response from server", server_response.statusCode);

        let content_type = server_response.headers["content-type"];

        let must_inject =
            (server_response.statusCode == 200 &&
             (!content_type ||
              content_type == "text/html" ||
              content_type.startsWith("text/html;")));

        console.log(content_type, must_inject);

        resp_encoding = server_response.headers["content-encoding"];
        console.log("resp recv from server: content encoding: ",
                    resp_encoding);
        console.log("resp recv from server: transfer encoding: ",
                    server_response.headers["transfer-encoding"]);

        if (must_inject){
            console.log("===> inject");
            server_response.headers["transfer-encoding"] = 'chunked';
            // delete proxy_response.headers["transfer-encoding"];
            delete server_response.headers["content-encoding"];

            // delete proxy_response.headers["content-length"];
            // proxy_response.headers["content-length"] = page.length;
        }

        // server_response.headers["Content-Security-Policy"] =
            // `script-src 'self' 'https://cdnjs.cloudflare.com' 'unsafe-inline'`;
            // `script-src self https://cdnjs.cloudflare.com 'unsafe-inline'`;

        console.log(server_response.headers);
        client_response.writeHead(server_response.statusCode,
                                  server_response.headers);

    };

    let proxy_request = http.request(options, onServerResponse);

    /**
     * handle request content (if any)
     */
    client_request.addListener('data', function(chunk) {
        console.log("got client data");
        proxy_request.write(chunk, 'binary');
    });

    client_request.addListener('end', function() {
        console.log("got client end");
        proxy_request.end();
    });
}


/*
 * https tunneling using 'connect' method
 */
function onProxyReceiveConnect(req, socket, head) {
    // console.log("got connect");

    let addr = req.url.split(':');
    //creating TCP connection to remote server
    let conn = net.connect(addr[1] || 443, addr[0], function() {
        // tell the client that the connection is established
        socket.write('HTTP/' + req.httpVersion + ' 200 OK\r\n\r\n', 'UTF-8', function() {
            // creating pipes in both ends
            conn.pipe(socket);
            socket.pipe(conn);
        });
    });

    conn.addListener('error', function(e) {
        console.log("Server connection error: " + e);
        socket.end();
    });
}


function main(){
    let port=8080;
    console.log("proxy started on port", port);
    let httpServer = http.createServer(onProxyReceiveRequest);
    httpServer.addListener('connect', onProxyReceiveConnect);

    // httpServer.addListener(
    //     "error", (err) =>{
    //         console.log("got socket error: ");
    //     // console.log(err.stack);
    //     });

    httpServer.listen(port);
}

main();

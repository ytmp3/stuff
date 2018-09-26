var net = require('net');
var url = require('url');
var http = require('http');
var process = require('process');
// var base64 = require('base64-stream');

var Base64encode = require('base64-stream').encode;

    var pre_data=`<!DOCTYPE html><html><head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.6/pako_inflate.min.js"></script>
<script type="text/javascript">
page_content='`;
    var post_data_inflate=`';

window.addEventListener("load", function(event) {
debugger;
    alert("Click to navigate!");
    debased = atob(page_content);
    unzipped = pako.inflate(debased);
    text = String.fromCharCode.apply(null, new Uint8Array(unzipped));
//    document.write(text);

    var dp = new DOMParser();
    var doc = dp.parseFromString(text, "text/html");

    var meta = document.createElement('meta');
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "script-src  'unsafe-inline'";
    doc.getElementsByTagName('head')[0].appendChild(meta);

    document.replaceChild(
    document.importNode(doc.documentElement, true),
    document.documentElement);

/*document.addEventListener("DOMContentLoaded", function(){

    var meta = document.createElement('meta');
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "script-src  'unsafe-inline'";
    document.getElementsByTagName('head')[0].appendChild(meta);
});
*/

    // setTimeout(function(){alert("I am still here");}, 5000);
});
    </script>
  </head>
  <body>THIS IS THE INJECTED PAGE</body>
</html>`;

    var post_data=`';

window.addEventListener("load", function(event) {
    alert("Click to navigate!");
    debased = atob(page_content);
    document.write(debased);
    document.close();
/*

    setTimeout(function(){
      var meta = document.createElement('meta');
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = "script-src  'unsafe-inline'";
      document.getElementsByTagName('head')[0].appendChild(meta);
   }, 1000);
*/
/*
    var dp = new DOMParser();
    var doc = dp.parseFromString(debased, "text/html");

    // var meta = document.createElement('meta');
    // meta.httpEquiv = "Content-Security-Policy";
    // meta.content = "script-src  'unsafe-inline'";
    // doc.getElementsByTagName('head')[0].appendChild(meta);

    document.replaceChild(
    document.importNode(doc.documentElement, true),
    document.documentElement);
*/
});
    </script>
  </head>
  <body>THIS IS THE INJECTED PAGE</body>
</html>`;


/**
 * handle client request
 */
function onServerReceiveRequest(request, response) {
    console.log("=========================================================");
    console.log("===> got request from browser");
    console.log(request.headers['host']);
    console.log(request.url);

    var parsedUrl = url.parse(request.url);
    // console.log("pathname=", parsedUrl.pathname);
    // console.log("search=", parsedUrl.search);

    var path = (parsedUrl.search != null)?
        parsedUrl.pathname + parsedUrl.search :
        parsedUrl.pathname;

    console.log("hostname=", parsedUrl.hostname);

    var must_inject = false;
    var pre_injected = false;
    var resp_encoding = null;

    // prevent compression of the server response
    request.headers["Accept-Encoding"] = "identity";

    // todo port/host
    var options = {
        // port: 80,
        host: parsedUrl.hostname,
        method: request.method,
        headers: request.headers,
        path: path
    };

    console.log(options.path);

    /**
     * relay response received from server to the client.  perform
     * script injection and base64 the content into a js variable.
     */
    var responseListener = function (proxy_response) {
        var b64 = new Base64encode();
        b64.pipe(response);

        proxy_response.addListener('data', function(chunk) {
            console.log("got server data");


            if (must_inject){
                if (!pre_injected){
                    response.write(pre_data);
                    pre_injected = true;
                }
                b64.write(chunk);
            }
            else{
                response.write(chunk, 'binary');
            }
        });
        proxy_response.addListener('end', function() {
            console.log("got server end");
            if (must_inject){
                if (resp_encoding && resp_encoding=="gzip"){
                    response.end(post_data_inflate);
                }else{
                    response.end(post_data);
                }
            }else{
                response.end();
            }
        });

        console.log("===> got response from server", proxy_response.statusCode);

        var content_type = proxy_response.headers["content-type"];

        var must_inject =
            (proxy_response.statusCode == 200 &&
             (!content_type ||
              content_type == "text/html" ||
              content_type.startsWith("text/html;")));

        console.log(content_type, must_inject);

        resp_encoding = proxy_response.headers["content-encoding"];
        console.log("resp recv from server: content encoding: ",
                    resp_encoding);
        console.log("resp recv from server: transfer encoding: ",
                    proxy_response.headers["transfer-encoding"]);

        if (must_inject){
            console.log("===> inject");
            proxy_response.headers["transfer-encoding"] = 'chunked';
            // delete proxy_response.headers["transfer-encoding"];
            delete proxy_response.headers["content-encoding"];

            // delete proxy_response.headers["content-length"];
            // proxy_response.headers["content-length"] = page.length;
        }

        proxy_response.headers["Content-Security-Policy"] = `script-src  'unsafe-inline'`;
        console.log(proxy_response.headers);
        response.writeHead(proxy_response.statusCode,
                           proxy_response.headers);

    };

    var proxy_request = http.request(options, responseListener);

    /**
     * handle request content (if any)
     */
    request.addListener('data', function(chunk) {
        console.log("got client data");
        proxy_request.write(chunk, 'binary');
    });

    request.addListener('end', function() {
        console.log("got client end");
        proxy_request.end();
    });
}

var port=8080;
console.log("proxy started on port", port);
httpServer = http.createServer(onServerReceiveRequest);



httpServer.on('connect', function(req, socket, head) {
    // console.log("got connect");

    var addr = req.url.split(':');
    //creating TCP connection to remote server
    var conn = net.connect(addr[1] || 443, addr[0], function() {
        // tell the client that the connection is established
        socket.write('HTTP/' + req.httpVersion + ' 200 OK\r\n\r\n', 'UTF-8', function() {
            // creating pipes in both ends
            conn.pipe(socket);
            socket.pipe(conn);
        });
    });

    conn.on('error', function(e) {
        console.log("Server connection error: " + e);
        socket.end();
    });
});

httpServer.listen(port);

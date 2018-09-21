var url = require('url');
var http = require('http');
var process = require('process');
var base64 = require('base64-stream');
// var {Base64Encode} = require('base64-stream');

var Base64encode = require('base64-stream').encode;

var page=`
<html>
<body>
hello
</body>
</html>
`;

function onServerReceiveRequest(request, response) {
    console.log("======================================================================");
    console.log("===> got request from browser");
    console.log(request.headers['host']);
    console.log(request.url);

    var parsedUrl = url.parse(request.url);
    console.log("pathname=", parsedUrl.pathname);
    console.log("search=", parsedUrl.search);

    var path = (parsedUrl.search != null)?
        parsedUrl.pathname + parsedUrl.search :
        parsedUrl.pathname;

    var must_inject = false;
    var pre_injected = false;

    request.headers["Accept-Encoding"] = "identity";

    // todo port/host
    var options = {
        port: 80,
        host: request.headers['host'],
        method: request.method,
        headers: request.headers,
        path: path
    };

    console.log(options.path);


    var pre_data=`<!DOCTYPE html><html><head>
<script type="text/javascript">
page_content='`;
    var post_data=`';

window.addEventListener("load", function(event) {
    alert("Click to navigate");
    decoded = atob(page_content);
    document.write(decoded);
});
    </script>
  </head>
  <body>THIS IS THE INJECTED PAGE</body>
</html>`;

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
                // response.write(chunk, 'binary');
                b64.write(chunk);
                // response.write(bufpage, 'binary');
            }
            else{
                response.write(chunk, 'binary');
            }
        });
        proxy_response.addListener('end', function() {
            console.log("got server end");
            if (must_inject){
                response.end(post_data);
            }else{
                response.end();
            }
        });

        console.log("===> got response from server", proxy_response.statusCode);

        // process.exit(1);

        var content_type = proxy_response.headers["content-type"];

        var must_inject =
            (proxy_response.statusCode == 200 &&
             (!content_type ||
              content_type == "text/html" ||
              content_type.startsWith("text/html;")));

        console.log(content_type, must_inject);

        // must_inject = false;
        if (must_inject){
            console.log("===> inject");
            proxy_response.headers["transfer-encoding"] = 'chunked';
            // delete proxy_response.headers["transfer-encoding"];
            delete proxy_response.headers["content-encoding"];
            // delete proxy_response.headers["content-length"];
            // proxy_response.headers["content-length"] = page.length;
        }

        console.log(proxy_response.headers);
        response.writeHead(proxy_response.statusCode,
                           proxy_response.headers);

    };

    var proxy_request = http.request(options, responseListener);


    request.addListener('data', function(chunk) {
        console.log("got client data");
        proxy_request.write(chunk, 'binary');
    });

    request.addListener('end', function() {
        console.log("got client end");
        proxy_request.end();
    });
}

http.createServer(onServerReceiveRequest).listen(8080);

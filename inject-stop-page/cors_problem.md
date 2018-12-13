## problem statement

### we try to send a cross-origin XHR from www.test-cors.org to server.test-cors.org

We hook the XMLHttpRequest 'send' method inject our custom header X-FP-BP-NO-INJECT

    POST /server?id=2909959&enable=true&status=200&credentials=false&headers=content-type%2CX-foo HTTP/1.1
    Host: server.test-cors.org
    User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0
    Accept: */*
    Accept-Language: en-US,en;q=0.5
    Accept-Encoding: gzip, deflate, br
    Referer: https://www.test-cors.org/
    content-type: application/json
    X-FP-BP-NO-INJECT: 1
    Origin: https://www.test-cors.org
    Connection: keep-alive
    Pragma: no-cache
    Cache-Control: no-cache
    Content-Length: 0


### the browser sends a preflight OPTIONS message

Since there is a json content-type, a preflight OPTIONS message is needed:

    OPTIONS /server?id=4411078&enable=true&status=200&credentials=false&headers=content-type HTTP/1.1
    Host: server.test-cors.org
    User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0
    Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
    Accept-Language: en-US,en;q=0.5
    Accept-Encoding: gzip, deflate, br
    Access-Control-Request-Method: POST
    Access-Control-Request-Headers: content-type,x-fp-bp-no-inject
    Referer: https://www.test-cors.org/
    Origin: https://www.test-cors.org
    Connection: keep-alive
    Pragma: no-cache
    Cache-Control: no-cache

### the mitm needs to strip the request-header

That is, it needs to remove our custom header from the
'access-control-allow-headers' in the 'OPTIONS' request message

If we don't strip the header, it does not work because the server does
not authorize our custom header.

    Access-Control-Request-Headers: content-type


### response from the server to the mitm

Obviously the server has not allowed our custom header (because we removed it)

    HTTP/1.1 200 OK
    cache-control: no-cache
    content-type: application/json
    access-control-allow-origin: https://www.test-cors.org
    set-cookie: cookie-from-server=noop
    access-control-allow-headers: content-type
    x-cloud-trace-context: dfb09da36c6ae6a08d0b1ac941491aec;o=1
    date: Thu, 13 Dec 2018 15:57:31 GMT
    server: Google Frontend
    expires: Thu, 13 Dec 2018 15:57:31 GMT
    transfer-encoding: chunked
    connection: close

### Now the browser receives the relayed response

And notices the server has not authorized our custom header, so it
rejects the request

    Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://server.test-cors.org/server?id=4411078&enable=true&status=200&credentials=false&headers=content-type. (Reason: missing token ‘x-fp-bp-no-inject’ in CORS header ‘Access-Control-Allow-Headers’ from CORS preflight channel).[


## conclusion

to make xhr cors work with our custom header we need the mitm:

- to remove our custom header from the 'access-control-allow-headers' in the 'OPTIONS' request message
- to add our custom header to the 'access-control-allow-headers' in the 'OPTIONS' response message

I assume that no context needs to be preserved between the 'OPTIONS'
request and response, that is, every time the response has a
access-control-allow-headers, we add our custom header to it.

Now, the problem is that this header might not be present. The only
thing that tells us this is an 'OPTIONS' response is the presence of
the 'access-control-allow-origin'

So the logic is:

- check if the response contains a 'access-control-allow-origin'
- if it does check if the response contains a 'access-control-allow-headers'
   - if it does change it
   - if it does not add one

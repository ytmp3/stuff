
forward proxy

http traffic is intercepted and a page is injected to obtain user
consent.  this page contains the real page as a base64/gzipped string. Once
consent is obtained, the page is uncompressed and displayed

https traffic is proxied using CONNECT, but not intercepted.


test page examples:

- http://www.sphinx-doc.org/en/master/
- http://gregfranko.com/blog/archives/
- http://la-vache-libre.org/

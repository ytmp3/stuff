blockpage poc
===============

3 prototypes:

- base64-page
- inject-in-place
- inject-stop-page (recommended)



## base64-page

In this prototype, we creates a whole new html page to display the overlay
(let's call it the overlay page) and this page is loaded instead of the
target page.

The trick is that the target page is contained inside the overlay page
as a base64 string.

Once the user confirms navigation, the target page is extracted and
displayed in client side.

### advantage of this approach

1. the overlay page completely blocks the target page (so no side effect
like music playing or 'accept cookie' popup showing up)

2. in the inspection, there is no need to parse the html to inject in
   the proper location: the target page is simply base64-encoded

### drawback of this approach

The lifecycle of the page loading is modified, which can have side
effects.  The solution is fairly complex and we need to deal with
encoding issue (utf-8, iso8859-1...) that are normally handled at http
level (content-type...).


## inject-in-place

In this prototype, we inject a piece of javascript in the page. This
javascript displays an overlay with a confirm button

There are 2 possible variations on where to inject:

 - proper injection after the <head> (required a bit of html parsing
   in the inspection)
 - add an extra doctype and inject out of the page

There are also 2 possible variations on what to inject:

 - inject a link to the javascript to load: less data, but requires a
   3rd party server to host our injection script (eg amazon server...)

 - inject the full content of the javascript directly in the page,
   this makes the page larger. For info, injected script size=3.6kB
   which is ~1% size of twitter/youtube html page.

### advantage of this approach

- fairly simple, the original page modifications are very small
- the original sequence of events that occur when the page loads are
  preserved.

### drawback of this approach

The target page is actually loaded in the background, while waiting
for confirm, which is visible from the user:
- if the target page has audio autostart, it starts to play right away
- 'accept cookie' popup might appear
- 'accept notifications' popup might appear
- not tested, but I think it can happen: if the page issues a
  javascript redirect, it probably will succeed, resulting in the confirm
  overlay not showing

## inject-stop-page (recommended)

This prototype is a variation of the inject-in-place approach: we also
inject our script in the page (same 4 possible variations as above),
but if the overlay needs to be displays, the script uses a browser api
to tell it that it should stop loading the page immediately.

When the user clicks confirm, the javascript asks the browser to
reload the page and this time the target page is shown. We also start
a timer. When the timer expires an overlay is shown on the existing
page (similar to the 'inject-in-place' approach)


This prototype is the most advanced. It also demonstrates:

- the use of user-defined html content for the confirm popup
- extra information passed to the page (e.g. category or timeout) and
  client-side template rendering
- csp header modification to safely permit execution of injected script
- confirm popup opened in an iframe, so that user-defined css does not
  interfere with target page css
- tested with firefox stable linux, chromium stable linux, IE11 and ms Edge
- injected code minified (3.6kB)

### advantage of this approach

- the confirm popup really blocks the page loading until confirm is pressed

- the display of the confirm popup is very fast since only the overlay
  is actually loaded, not the actual page.

- once confirmed, the target page is loaded with minimal changes on the page (we
  only start a timer to display the overlay again)


### drawback of this approach

- page loading is ended abruptly with a connection reset (I don't know
  if this is a problem though)

- We use a javascript api that is marked as deprecated by chrome (but
  still supported), since this api solves a lot of compatibility
  problems with ms Edge and IE11. We could do without it if absolutely
  needed, but the code would become more complicated with browser
  specific logic.

### install and start this demo

requirement: nodejs v10.1.0

steps:

    $ cd inject-stop-page
    $ npm install
    $ npm start

If ok, the following message appears:

    Make sure your browser trusts this CA:
    /data/mydocs/projects/blockpage/poc/inject-stop-page/.http-mitm-proxy/certs/ca.pem
    Proxy running on port 8081

Now you need to configure your browser to:
- add the ca.pem to the list of authorized ca
- configure the browser proxy to be your-host-or-ip:8081 for both http and https

Now you can open any url and make sure the confirm page is displayed
at opening and after timeout. If you navigate to another page of the
same domain, the confirm page should not show up again.

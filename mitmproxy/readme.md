
### install

    pip3 install mitmproxy

or in dev env:

    git clone https://github.com/mitmproxy/mitmproxy
    apt-get install python3-venv
    cd mitmproxy
    ./dev.sh
    . venv/bin/activate

### start proxy

    mitmdump -s ./mitm_inject.py -q

### install ca in your browser

    ~/.mitmproxy/mitmproxy-ca-cert.pem


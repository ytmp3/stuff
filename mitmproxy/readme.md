
### install

    pip3 install mitmproxy

or dev env:

    apt-get install python3-venv
    ./dev.sh
    . venv/bin/activate

### start proxy

    mitmdump -s ./mitm_inject.py -q

### install ca in your browser

    ~/.mitmproxy/mitmproxy-ca-cert.pem


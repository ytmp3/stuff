#!/bin/bash

export http_proxy=http://localhost:8081
export https_proxy=http://localhost:8081

ca=.http-mitm-proxy/certs/ca.pem

curl --cacert ${ca} $1

# curl --cacert ${ca} http://localhost:1234/hello.html

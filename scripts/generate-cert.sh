#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <VPS_IP_ADDRESS>"
  echo "Example: $0 1.2.3.4"
  exit 1
fi

IP="$1"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -certout cert.pem \
  -subj "/CN=SelfSigned" \
  -addext "subjectAltName = IP:${IP}"

echo "Generated key.pem and cert.pem for IP: ${IP}"
echo "Valid for 365 days"

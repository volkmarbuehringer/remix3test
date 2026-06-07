## 1. Server.ts TLS integration

- [x] 1.1 Import `https` from `node:https` at the top of `server.ts`
- [x] 2.1 Add conditional TLS logic in `server.ts`: if `NODE_ENV === 'production'`, read `key.pem` and `cert.pem` with `fs.readFileSync` and create `https.createServer`; otherwise, keep existing `http.createServer`
- [x] 3.1 Add graceful error handling for missing cert files in production (log error, exit with code 1)
- [x] 4.1 Update the server startup log message to show `https` when in production mode

## 2. Scripts

- [x] 5.1 Add `scripts/generate-cert.sh` with the openssl command for generating a self-signed cert with IP SAN

## 3. Documentation

- [x] 6.1 Note in server startup log how to generate certs for a VPS IP address

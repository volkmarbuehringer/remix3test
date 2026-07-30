## 1. Asset server HMR configuration

- [x] 1.1 Add `hmr` option and `uiHmr()` browser module hook to `app/assets.ts`
- [x] 1.2 Add `watch` option to asset server config for development

## 2. Dev supervisor entry point

- [x] 2.1 Create `dev.ts` with `node-hmr` supervisor, fetch proxy, and browser HMR channel

## 3. Server readiness signal

- [x] 3.1 Add `emitServerReady()` call in `server.ts` after `server.listen()`

## 4. Package scripts

- [x] 4.1 Update `dev` script in `package.json` to use `dev.ts`

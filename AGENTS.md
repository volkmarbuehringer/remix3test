# Testapp Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```

This App uses Remix 3, no REACT

at .opencode/skills/ are skills for Remix 3 development

## Remix Source References

When you need API docs or usage examples for a `remix/*` subpath:

- READMEs: `~/remix/packages/<package>/README.md` or `~/remix/packages/remix/src/<subpath>/README.md`
- Demos: `~/remix/demos/<demo-name>/`

## Building Features

Refer to `.opencode/skills/remix/SKILL.md` (plus 11 specialized skills: remix3-multiple-route-trees, remix-cli-devops, remix-cookies, remix-demos, remix-fetch-proxy, remix-file-uploads, remix-headers, remix-html-template, remix-render-middleware, remix-response-helpers, remix-security-middleware)

## Starter Layout

- `app/actions/controller.tsx` owns the top-level route actions
- `app/routes.ts` defines the route contract
- `app/router.ts` wires routes to route handlers
- `app/middleware/render.tsx` installs the request-scoped renderer used by actions
- `app/ui/` holds the shared document shell and home page UI
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer
- `public/` contains static files served from the app root

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` for nested route maps that need their own actions or middleware.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/` and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.


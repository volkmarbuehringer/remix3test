## ADDED Requirements

### Requirement: NavLink supports rmx-src attribute

The `app/ui/nav-link.tsx` SHALL accept an optional `frameSrc` string prop and pass it through to the rendered `<a>` element as `rmx-src={frameSrc}`.

#### Scenario: NavLink renders rmx-src when frameSrc prop is provided
- **WHEN** a `frameSrc` string is passed to the `NavLink` component
- **THEN** the rendered `<a>` element SHALL include an `rmx-src` attribute with the provided value

#### Scenario: NavLink omits rmx-src when frameSrc prop is undefined
- **WHEN** no `frameSrc` prop is passed to the `NavLink` component
- **THEN** the rendered `<a>` element SHALL NOT include an `rmx-src` attribute

### Requirement: Render middleware follows frame redirects

The `resolveFrame` function in `app/middleware/render.tsx` SHALL follow HTTP redirects (3xx with `Location` header) when fetching frame content, up to a maximum of 10 redirect hops, before returning the final response.

#### Scenario: Frame fetch follows a single redirect
- **WHEN** a frame fetch request receives a 302 response with a `Location` header
- **THEN** the middleware SHALL issue a new GET request to the URL specified in `Location`
- **THEN** the middleware SHALL return the response from the redirected request

#### Scenario: Frame fetch stops at non-redirect response
- **WHEN** a frame fetch request receives a 200 (or any non-3xx) response
- **THEN** the middleware SHALL return that response directly without further redirect following

#### Scenario: Frame fetch aborts after too many redirects
- **WHEN** a frame fetch encounters more than 10 consecutive redirects
- **THEN** the middleware SHALL throw an error with message "Too many frame redirects"

#### Scenario: Frame fetch returns error HTML on failure
- **WHEN** the final response after redirect following has a non-ok status
- **THEN** `resolveFrame` SHALL return an HTML string `<pre>Frame error: {status} {statusText}</pre>`

### Requirement: Auth middleware handles frame 401 gracefully

The `requireAuth()` middleware in `app/middleware/auth.ts` SHALL detect frame requests via the `X-Remix-Frame` header and return inline error HTML with status 401 instead of a full-page redirect, when the header is present.

#### Scenario: Unauthenticated frame request receives inline 401
- **WHEN** an unauthenticated request has header `X-Remix-Frame: true`
- **THEN** the middleware SHALL return a Response with status 401 and a Content-Type of `text/html; charset=UTF-8`
- **THEN** the response body SHALL contain an HTML message indicating the session has expired

#### Scenario: Unauthenticated top-level request still redirects to login
- **WHEN** an unauthenticated request does NOT have the `X-Remix-Frame` header
- **THEN** the middleware SHALL redirect to the login page as before (existing behavior unchanged)

### Requirement: @types/dom-navigation added as devDependency

The project SHALL add `@types/dom-navigation` as a devDependency to explicitly document that the frame navigation system depends on the DOM Navigation API.

#### Scenario: Package.json includes @types/dom-navigation
- **WHEN** the project is set up after changes
- **THEN** `@types/dom-navigation` SHALL be listed in `devDependencies`
- **THEN** `tsc --noEmit` SHALL pass without type errors related to `Navigation` types

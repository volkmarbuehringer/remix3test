<!-- Context: development/remix3/packages/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-08 -->
<!-- Source: http://localhost:44100/ (Remix 3 v3.0.0-beta.0 API docs) -->

# Remix 3 API Snapshot

**Core Concept**: Complete export index for all `remix` packages (v3.0.0-beta.0), organized by category. Use as quick reference for available imports.

**Key Points**:
- All packages import from `remix/{package-name}` — no bundler required
- 80+ packages across 6 categories: Core, Middleware, Data, Storage, UI, Server/CLI
- Zero-dependency philosophy — each package is independently useful
- No React — Remix 3 uses its own `remix/ui` component system

---

## Core Packages

| Package | Key Exports |
|---------|-------------|
| `assert` | `assert()`, `equal()`, `deepEqual()`, `expect()`, `ok()`, `fail()`, `throws()`, `rejects()` |
| `assets` | `createAssetServer()`, `AssetServer`, `AssetServerOptions` |
| `async-context-middleware` | `asyncContext()`, `getContext()`, `AsyncRequestContext` |
| `auth` | `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, `completeAuth()`, `refreshExternalAuth()`, `create${Provider}AuthProvider()` |
| `auth-middleware` | `auth()`, `requireAuth()`, `createSessionAuthScheme()`, `createBearerTokenAuthScheme()`, `createAPIAuthScheme()` |
| `cli` | `runRemix()`, `RunRemixOptions` |
| `cookie` | `createCookie()`, `Cookie`, `CookieOptions` |
| `fetch-proxy` | `createFetchProxy()`, `FetchProxy`, `FetchProxyOptions` |
| `fetch-router` | `createRouter()`, `createAction()`, `createContextKey()`, `createController()`, `Router`, `RequestContext` |
| `fs` | `openLazyFile()`, `writeFile()`, `OpenLazyFileOptions` |
| `headers` | `Cookie`, `CacheControl`, `ContentType`, `Accept`, `SetCookie`, `SuperHeaders`, `Vary`, `parse()`, `stringify()` |
| `html-template` | `html()`, `isSafeHtml()`, `SafeHtml` |
| `lazy-file` | `LazyFile`, `LazyBlob`, `getByteLength()`, `getIndexes()` |
| `mime` | `detectMimeType()`, `detectContentType()`, `isCompressibleMimeType()`, `defineMimeType()` |
| `multipart-parser` | `parseMultipartRequest()`, `parseMultipart()`, `parseMultipartStream()`, `MultipartParser` |
| `response` | `createHtmlResponse()`, `createRedirectResponse()`, `createFileResponse()`, `compressResponse()` |
| `route-pattern` | `createMatcher()`, `RoutePattern`, `Match`, `HrefError`, `ascending()`, `compare()`, `descending()` |
| `routes` | `createRoutes()`, `createGetRoute()`, `createPostRoute()`, `createFormRoutes()`, `createResourceRoutes()`, `form()`, `route()`, `resource()` |
| `session` | `createSession()`, `createSessionId()`, `Session`, `SessionStorage` |
| `session-middleware` | `session()` |
| `tar-parser` | `parseTar()`, `parseTarHeader()`, `TarParser`, `TarEntry` |
| `terminal` | `createTerminal()`, `createStyles()`, `shouldUseColors()`, `stripAnsi()`, `Terminal`, `ansi` |

---

## Middleware

| Package | Key Exports |
|---------|-------------|
| `compression-middleware` | `compression()`, `CompressionOptions` |
| `cop-middleware` | `cop()`, `CopDenyHandler`, `CopOptions` — tokenless CSRF |
| `cors-middleware` | `cors()`, `CorsOriginResolver`, `CorsAllowedHeadersResolver`, `CorsOptions` |
| `csrf-middleware` | `csrf()`, `getCsrfToken()`, `CsrfOriginResolver`, `CsrfTokenResolver` |
| `form-data-middleware` | `formData()`, `FileUploadHandler`, `FormDataOptions` |
| `form-data-parser` | `parseFormData()`, `FileUploadHandler`, `MultipartParseError` |
| `logger-middleware` | `logger()`, `LoggerOptions` |
| `method-override-middleware` | `methodOverride()`, `MethodOverrideOptions` |
| `static-middleware` | `staticFiles()`, `StaticFilesOptions` |

---

## Data Packages

| Package | Key Exports |
|---------|-------------|
| `data-schema` | `string()`, `number()`, `boolean()`, `object()`, `array()`, `parse()`, `parseSafe()`, `ValidationError`, `Schema` |
| `data-schema/checks` | `email()`, `url()`, `min()`, `max()`, `minLength()`, `maxLength()` |
| `data-schema/coerce` | `string()`, `number()`, `boolean()`, `bigint()`, `date()` |
| `data-schema/form-data` | `field()`, `fields()`, `file()`, `files()`, `object()`, `FormDataSchema` |
| `data-schema/lazy` | `lazy()` |
| `data-table` | `createDatabase()`, `table()`, `query()`, `hasMany()`, `belongsTo()`, `hasOne()`, `DatabaseAdapter` |
| `data-table/migrations` | `createMigration()`, `createMigrationRegistry()`, `createMigrationRunner()`, `Migration` |
| `data-table/operators` | `eq()`, `neq()`, `gt()`, `gte()`, `lt()`, `lte()`, `like()`, `ilike()`, `inList()`, `and()`, `or()` |
| `data-table/sql-helpers` | `quoteIdentifier()`, `quoteLiteral()`, `quoteTableRef()`, `collectColumns()` |
| `data-table-mysql` | `createMysqlDatabaseAdapter()`, `MysqlDatabaseAdapter` |
| `data-table-postgres` | `createPostgresDatabaseAdapter()`, `PostgresDatabaseAdapter` |
| `data-table-sqlite` | `createSqliteDatabaseAdapter()`, `SqliteDatabaseAdapter` |

---

## Storage

| Package | Key Exports |
|---------|-------------|
| `file-storage` | `createFsFileStorage()`, `createMemoryFileStorage()`, `FileStorage` |
| `file-storage-s3` | `createS3FileStorage()`, `S3FileStorageOptions` |
| `session/cookie-storage` | `createCookieSessionStorage()` |
| `session/fs-storage` | `createFsSessionStorage()`, `FsSessionStorageOptions` |
| `session/memory-storage` | `createMemorySessionStorage()` |
| `session-storage-memcache` | `createMemcacheSessionStorage()`, `MemcacheSessionStorageOptions` |
| `session-storage-redis` | `createRedisSessionStorage()`, `RedisSessionStorageOptions`, `RedisSessionStorageClient` |

---

## Server / CLI

| Package | Key Exports |
|---------|-------------|
| `node-fetch-server` | `createRequestListener()`, `createRequest()`, `createHeaders()`, `sendResponse()`, `FetchHandler` |
| `node-fetch-server/test` | `createTestServer()`, `TestServer` |
| `node-serve` | `serve()`, `createUwsRequestHandler()`, `UwsRequestHandler`, `ErrorHandler` (uWebSockets) |

---

## UI Packages (`remix/ui`)

| Sub-package | Key Exports |
|-------------|-------------|
| *(root)* | `run()`, `clientEntry()`, `createRoot()`, `Frame`, `Fragment`, `createElement()`, `css()`, `navigate()`, `on()`, `link()`, `createMixin()`, `createScheduler()`, `attrs()`, `ref()` |
| `accordion` | `AccordionProps`, `AccordionItemProps`, `AccordionTriggerProps`, `AccordionContentProps` |
| `anchor` | `AnchorOptions`, `AnchorPlacement` |
| `animation` | `spring()`, `tween()`, `animateEntrance()`, `animateExit()`, `animateLayout()`, `easings` |
| `breadcrumbs` | `BreadcrumbsProps`, `BreadcrumbItem` |
| `button` | `ButtonProps`, `ButtonTone`, `baseStyle()`, `primaryStyle()`, `secondaryStyle()`, `dangerStyle()`, `ghostStyle()` |
| `combobox` | `ComboboxProps`, `ComboboxContextProps`, `ComboboxHandle`, `ComboboxOptionProps` |
| `glyph` | `GlyphProps`, `GlyphName`, `GlyphSymbol`, `GlyphSheetProps`, `GlyphValues` |
| `jsx-runtime` | `jsx()`, `jsxs()`, `jsxDEV()`, `Fragment` |
| `listbox` | `ListboxProviderProps`, `ListboxOption`, `ListboxContext`, `ListboxRef` |
| `menu` | `MenuProps`, `MenuItemProps`, `MenuProviderProps`, `SubmenuProps` |
| `popover` | `PopoverProps`, `PopoverContext`, `PopoverSurfaceOptions` |
| `select` | `SelectProps`, `SelectContextProps`, `SelectOptionProps` |
| `server` | `renderToStream()`, `renderToString()`, `RenderToStreamOptions` |
| `test` | `render()`, `RenderOptions`, `RenderResult` |
| `theme` | `CreateThemeOptions`, `ThemeComponent`, `ThemeVars`, `ThemeMix`, `GlyphContract` |

---

## Test

| Package | Key Exports |
|---------|-------------|
| `test` | `test()`, `describe()`, `it()`, `beforeAll()`, `afterAll()`, `beforeEach()`, `afterEach()`, `mock`, `RemixTestPool` |
| `test/cli` | `runRemixTest()`, `getRemixTestHelpText()`, `RunRemixTestOptions` |

---

## Quick Example

```ts
import { createRouter } from 'remix/fetch-router'
import { auth } from 'remix/auth-middleware'
import { session } from 'remix/session-middleware'
import { createCookie } from 'remix/cookie'
import { html } from 'remix/html-template'
import { string, object, parse } from 'remix/data-schema'
import { createDatabase, table } from 'remix/data-table'
import { run } from 'remix/ui'

const router = createRouter()
router.use(session({ secret: '…' }))
router.use(auth({ scheme: createSessionAuthScheme() }))
```

---

**Source**: `http://localhost:44100/` — Remix 3 v3.0.0-beta.0 API docs
**Related**: `packages/lookup/package-index.md` (structured per-package docs), `packages/concepts/` (per-package deep dives)

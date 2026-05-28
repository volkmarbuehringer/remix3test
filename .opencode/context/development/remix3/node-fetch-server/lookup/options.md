<!-- Context: development/remix3/node-fetch-server/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Lookup: Options Reference

**Purpose**: Quick reference for `createRequestListener` and `createRequest` options.

## RequestListenerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | Host header value | Override the hostname in the request URL |
| `protocol` | `string` | `http:` or `https:` (auto-detected) | Override the protocol in the request URL |
| `onError` | `ErrorHandler` | `console.error` + 500 response | Custom error handler; can return a Response |

## RequestOptions

`RequestOptions = Omit<RequestListenerOptions, 'onError'>`

Same as `RequestListenerOptions` minus `onError` (used by `createRequest`).

## ErrorHandler Signature

```ts
interface ErrorHandler {
  (error: unknown): void | Response | Promise<void | Response>
}
```

## Usage Examples

```ts
// Override host + protocol
createRequestListener(handler, {
  host: 'api.example.com',
  protocol: 'https:',
})

// Custom error handler
createRequestListener(handler, {
  async onError(error) {
    console.error('Server error:', error)
    return new Response('Oops', { status: 500 })
  }
})
```

## Related

- `concepts/server-architecture.md` — How options affect dispatch
- `concepts/handler-types.md` — ErrorHandler type definition

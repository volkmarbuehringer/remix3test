# Example: toastRedirect() Usage

**Purpose**: Redirect with toast message in URL params (server-rendered toasts)

## Usage

```typescript
import { toastRedirect } from '../../../utils/toast.ts'

// Success toast
return toastRedirect(routes.admin.books.index.href(), 'Book created')

// Error toast (isError = true)
return toastRedirect(url, 'Cannot delete', true)

// With pagination preserved
let page = parsePage(url)
let sort = parseSort(url)
let redirectUrl = buildBackUrl(routes.admin.books.index.href(), page, sort)
return toastRedirect(redirectUrl, 'Book updated')
```

## Pattern

| Call                              | Result                           |
| --------------------------------- | -------------------------------- |
| `toastRedirect(url, 'msg')`       | Redirect to `url?toast=msg`      |
| `toastRedirect(url, 'msg', true)` | Redirect to `url?toastError=msg` |

## Implementation

```typescript
// app/utils/toast.ts
export function toastRedirect(url: string, message: string, isError = false): Response {
  let params = new URLSearchParams()
  params.set(isError ? 'toastError' : 'toast', message)
  let separator = url.includes('?') ? '&' : '?'
  return redirect(`${url}${separator}${params.toString()}`)
}
```

## Index Page Extraction

```typescript
async index({ get, url }) {
  let toast = url.searchParams.get('toast') ?? undefined
  let toastError = url.searchParams.get('toastError') ?? undefined

  return render(
    <Layout toast={toast} toastError={toastError}>
      <AdminBooksIndexPage {...props} />
    </Layout>
  )
}
```

**Reference**: `concepts/toast-system.md`, `examples/toast-pattern.md`

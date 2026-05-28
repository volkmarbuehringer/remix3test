<!-- Context: development/remix3/guides/input-validation | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Input Validation

Generic input sanitization and validation for form data, URL parameters, and user-generated content.

## Problem
User input may be too long (buffer overflow risks), contain invalid characters (XSS, injection), or missing entirely (null/undefined).

## Sanitization Pattern
Always sanitize at the boundary before processing or storing.

### String Sanitization
```typescript
export function sanitizeString(value: string | null, maxLength = 100, allowedChars = /[\w]/): string {
  return (value ?? '').slice(0, maxLength).replace(new RegExp(`[^${allowedChars.source}]`, 'g'), '') || 'default'
}
```

### Room/Identifier Sanitization
```typescript
export function sanitizeRoom(room: string | null): string { return sanitizeString(room, 50, /[\w-]/) }
export function sanitizeUsername(username: string | null): string { return sanitizeString(username, 30, /[\w]/) }
```

### URL Parameter Extraction
```typescript
export function getRequiredParam(formData: FormData, name: string): string {
  let value = formData.get(name) as string | null
  if (!value) throw new Response('Missing required parameter', { status: 400 })
  return value
}
```

### Message Content Sanitization
For user-generated content like chat messages, sanitize to prevent XSS while allowing readable text:
```typescript
export function sanitizeMessage(message: string | null): string {
  return (message ?? '').slice(0, 1000).replace(/[<>'"&]/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim()
}
```
Strips dangerous chars but allows punctuation/whitespace. For stricter filtering, modify the regex.

## Usage in Route Action
```typescript
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData()
  let room = sanitizeRoom(formData.get('room') as string | null)
  let username = sanitizeUsername(formData.get('username') as string | null)
  let message = { room, username, timestamp: Date.now() }
}
```

## Controller Validation Pattern
```typescript
async add({ get }) {
  let formData = get(FormData)
  let bookId = formData.get('bookId') as string | undefined
  if (!bookId || bookId.trim() === '') return new Response('Invalid book ID', { status: 400 })
  let parsedId = parseInt(bookId, 10)
  if (isNaN(parsedId)) return new Response('Invalid book ID', { status: 400 })
  let book = await db.find(books, parsedId)
  if (!book) return new Response('Book not found', { status: 404 })
}
```

## Safe JSON Parsing
```typescript
let imageUrls: string[]
try { imageUrls = JSON.parse(book.image_urls) } catch { imageUrls = [] }
```

## Quantity Validation
```typescript
let quantity = parseInt(formData.get('quantity'), 10)
if (isNaN(quantity) || quantity < 1) return new Response('Invalid quantity', { status: 400 })
```

## Validation Status Codes
| Scenario | Status | Usage |
|----------|--------|-------|
| Missing/invalid input | 400 | Bad Request |
| Resource not found | 404 | Entity doesn't exist |
| Success no content | 204 | DELETE/UPDATE success |
| Success with data | 200 | Normal response |

## Validation vs Sanitization
| Approach | Purpose | Example |
|----------|---------|---------|
| **Validation** | Reject invalid input with error | Zod schema, explicit checks |
| **Sanitization** | Clean input to be safe | slice, replace, defaults |

Use both: 1. Sanitize first (strip dangerous chars) 2. Validate second (Zod)

## Common Patterns
| Input Type | Max Length | Allowed Characters | Default |
|------------|------------|--------------------|---------|
| Username | 30 | `\w` (alphanumeric + underscore) | `anonymous` |
| Room name | 50 | `\w-` (alphanumeric + dash/underscore) | `default` |
| Message | 1000 | Alphanumeric, punctuation, whitespace | `""` |
| Email | 255 | Standard email chars | invalid |
| URL slug | 100 | `\w-` | `invalid` |

## Security Notes
- Never trust client-side validation alone
- Sanitize before storing in database
- Escape on output for XSS prevention
- Use Zod for schema validation with `z.string().min().max()`

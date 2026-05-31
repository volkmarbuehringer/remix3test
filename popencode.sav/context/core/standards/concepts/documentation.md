<!-- Context: standards/docs | Priority: critical | Version: 2.1 | Updated: 2026-05-03 -->

# Documentation Standards

**Core Concept**: Document WHY decisions, complex logic, and public APIs. Show don't tell. Golden Rule: if users ask the same question twice, document it.

---

## Key Points

- **Audience-focused**: Users (what/how), devs (why/when), contributors (setup)
- **Show, don't tell**: Code examples, real use cases, expected output
- **Keep current**: Update with code changes, mark deprecations
- **Don't document**: Obvious code (`i++`), what code does (should be self-explanatory)

---

## README Template

```markdown
# Project — Brief description
## Features — Key capabilities
## Installation — `npm install pkg`
## Quick Start — Minimal working example
## Usage — Detailed examples
## API Reference — If applicable
```

---

## Function Documentation

```javascript
/**
 * Calculate total with tax
 * @param {number} price - Base price
 * @param {number} taxRate - Rate (0-1)
 * @returns {number} Total with tax
 * @example calculateTotal(100, 0.1) // 110
 */
function calculateTotal(price, taxRate) { return price * (1 + taxRate) }
```

---

## DO vs DON'T

| ✅ DO | ❌ DON'T |
|-------|----------|
| WHY decisions were made | Obvious code (`i++`) |
| Complex algorithms | What code does |
| Public APIs, setup, use cases | Redundant information |
| Known limitations, workarounds | Outdated/incorrect info |

---

## Comments

```javascript
// ✅ Good: Explains WHY
// HACK: API returns null instead of [], normalize
const items = response.items || []

// ❌ Bad: States the obvious
i++        // Increment i
const u = getUser()  // Get user
```

---

## API Docs Template

```markdown
### POST /api/users — Create a user
**Request:** `{ "name": "John" }` → **Response:** `{ "id": "123", "name": "John" }`
**Errors:** 400 invalid input, 409 email exists
```

**Reference**: See also `code-quality.md`, `test-coverage.md`

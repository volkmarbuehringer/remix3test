<!-- Context: standards/tests | Priority: critical | Version: 2.1 | Updated: 2026-05-03 -->

# Testing Standards

**Core Concept**: Test behavior, not implementation. AAA pattern (Arrange → Act → Assert). Golden Rule: if you can't test it easily, refactor it.

---

## Key Points

- **Test behavior, not implementation** — what code does, not how
- **One assertion per test**, clear names, minimal setup
- **Independent tests** — no shared state, any order
- **Fast and reliable** — quick, deterministic, no flakiness
- **Test**: Happy path, edge cases, error cases, business logic
- **Don't test**: Third-party libs, framework internals, simple getters

---

## Coverage Goals

| Tier | Scope | Target |
|------|-------|--------|
| Critical | Business logic, data transforms | 100% |
| High | Public APIs, user-facing features | 90%+ |
| Medium | Utilities, helpers | 80%+ |
| Low | Simple wrappers, configs | Optional |

---

## Quick Examples

### AAA Pattern
```javascript
test('calculateTotal returns sum', () => {
  const items = [{ price: 10 }, { price: 20 }]          // Arrange
  const result = calculateTotal(items)                   // Act
  expect(result).toBe(30)                                // Assert
})
```

### Dependency Injection + Mock
```javascript
function createService(database) {
  return { getUser: (id) => database.findById('users', id) }
}
test('getUser calls database', () => {
  const mockDb = { findById: () => ({ id: 1 }) }
  expect(createService(mockDb).getUser(1).id).toBe(1)
})
```

### Naming Convention
```javascript
// ✅ Good
test('calculateDiscount returns 10% off for premium users', () => {})
test('validateEmail returns false for invalid format', () => {})
// ❌ Bad
test('it works', () => {})
```

**Reference**: See also `code-quality.md`

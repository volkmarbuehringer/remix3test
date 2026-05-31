<!-- Context: core/essential-patterns | Priority: critical | Version: 1.2 | Updated: 2026-04-03 -->

# Essential Patterns

**Core Philosophy**: Modular, Functional, Maintainable

**Framework**: This project uses **`remix/ui`**, NOT React. Do NOT use React hooks or patterns.

---

## Critical Patterns

### 1. Pure Functions

- Same input = same output
- No side effects, no mutation
- Predictable and testable

### 2. Error Handling

- Catch specific errors, not generic
- Log with context, return meaningful messages
- Never expose internal implementation details

### 3. Input Validation

- Check null/nil values
- Validate types, ranges, constraints
- Sanitize user input, return clear errors

### 4. Security

- NEVER expose secrets in logs
- Use env vars for credentials
- Parameterized queries (prevent SQL injection)
- Validate and escape output (prevent XSS)

### 5. Logging

- **Debug**: Detailed dev info
- **Info**: Important events
- **Warning**: Potential issues
- **Error**: Failures and exceptions

---

## Code Structure

**Modular**: Single responsibility, <100 lines per component

**Functional**:

- Pure functions
- Immutability (create new data)
- Composition over inheritance
- Declarative style

---

## Anti-Patterns

**Code Smells**:

- ❌ Mutation and side effects
- ❌ Deep nesting (>3 levels)
- ❌ God modules (>200 lines)
- ❌ Global state, large functions

**Security**:

- ❌ Hardcoded credentials
- ❌ Exposed secrets in logs
- ❌ Unvalidated input
- ❌ SQL/XSS vulnerabilities

---

## Testing

- Unit tests for pure functions
- Integration tests for components
- Test edge cases and errors
- Use descriptive test names

---

## Related

- `core/standards/code-quality.md` - Detailed code standards
- `core/standards/security-patterns.md` - Security patterns
- `core/standards/test-coverage.md` - Testing standards

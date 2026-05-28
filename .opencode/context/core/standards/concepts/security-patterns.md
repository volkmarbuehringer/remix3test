<!-- Context: standards/patterns/security | Priority: high | Version: 2.0 | Updated: 2026-04-15 -->

# Security Patterns

**Purpose**: Language-agnostic security best practices

---

## Core Rules

**ALWAYS**:
- Validate and sanitize all user input
- Use environment variables for secrets
- Return generic error messages in auth
- Follow principle of least privilege

**NEVER**:
- Expose passwords, tokens, API keys in logs
- Expose internal error details to users
- Hardcode credentials

---

## Authentication Security

**Prevent user enumeration**:
```typescript
async function verifyCredentials(email, password) {
  const user = await db.findOne(users, { where: { email } })
  if (!user) {
    console.log(`[Auth] Login failed: user not found`) // Log, don't expose
    return null // Generic response
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    console.log(`[Auth] Login failed: wrong password`) // Log, don't expose
    return null
  }
  return user
}
// Always return: "Invalid credentials" - never say which field is wrong
```

**Add rate limiting** on login endpoints to prevent brute force.

---

## Session Management

- Use HttpOnly cookies
- Set SameSite and Secure flags
- Implement session rotation on login

---

## Input Validation

- Check for null/nil/None values
- Validate data types
- Validate ranges and constraints
- Sanitize user input

---

## File System Safety

- Prevent path traversal attacks (`../`, `..%2F`)
- Check file permissions before operations
- Use absolute paths when possible

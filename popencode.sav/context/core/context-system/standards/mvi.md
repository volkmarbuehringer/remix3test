<!-- Context: core/mvi | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# MVI Principle (Minimal Viable Information)

**Purpose**: Extract only core concepts, not verbose explanations

**Last Updated**: 2026-01-06

---

## Core Idea

Extract the **minimum information** needed for an AI agent to understand and use a concept:
- Core concept (1-3 sentences)
- Key points (3-5 bullets)
- Minimal working example
- Reference link to full docs

**Goal**: Scannable in <30 seconds. Reference full docs, don't duplicate them.

---

## The Formula

```
Core Concept (1-3 sentences)
  ↓
Key Points (3-5 bullets)
  ↓
Quick Example (5-10 lines)
  ↓
Reference Link (full docs)
  ↓
Related Files (cross-refs)
```

---

## What to Extract ✅

- **Core definitions** - What it is (1-3 sentences)
- **Key properties** - Essential characteristics (3-5 bullets)
- **Minimal example** - Simplest working code (5-10 lines)
- **Common patterns** - How it's typically used (2-3 bullets)
- **Critical gotchas** - Must-know issues (1-2 bullets)
- **Reference links** - Where to learn more

---

## What to Skip ❌

- **Verbose explanations** - Link to docs instead
- **Complete API docs** - Summarize + reference
- **Implementation details** - Show minimal example + reference
- **Historical context** - Unless critical to understanding
- **Marketing content** - Just the facts
- **Duplicate information** - Say it once, reference elsewhere

---

## Example: JWT Authentication

**✅ MVI Compliant**:
- Core Idea: Stateless auth using signed JSON Web Tokens
- Key Points: 3 parts (header.payload.signature), server verifies, stateless, expires, httpOnly cookie
- Quick Example:
  ```js
  const token = jwt.sign({ userId: 123 }, SECRET_KEY, { expiresIn: '1h' })
  const decoded = jwt.verify(token, SECRET_KEY)
  ```
- Reference: https://jwt.io/introduction

❌ Too Verbose: Full RFC history, multiple edge cases, implementation internals. See `compact.md`.

---

## File Size Limits

<rule id="size_limits" enforcement="strict">
  - Concept files: max 100 lines
  - Example files: max 80 lines
  - Guide files: max 150 lines
  - Lookup files: max 100 lines
  - Error files: max 150 lines
  - README files: max 100 lines
</rule>

**Why**: Forces brevity. If you need more, split into multiple files or reference external docs.

---

## Related

- structure.md - Where files go
- compact.md - How to minimize
- templates.md - Standard formats
- creation.md - File creation rules

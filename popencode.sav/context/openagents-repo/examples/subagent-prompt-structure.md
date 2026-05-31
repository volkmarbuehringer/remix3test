<!-- Context: openagents-repo/examples | Priority: high | Version: 1.1 | Updated: 2026-04-12 -->

# Subagent Prompt Structure

**Purpose**: Template for well-structured subagent prompts.

## Core Principle

Position critical instructions in first 15% of prompt. The most critical is **which tools to use**.

---

## Minimal Example

```xml
---
# Frontmatter (lines 1-50)
id: subagent-name
name: Subagent Name
tools:
  read: true
  grep: true
  glob: true
  bash: false
  edit: false
  write: false
permissions:
  bash: "*": "deny"
  edit: "**/*": "deny"
---

> **Mission**: One-sentence mission statement

Brief description (1-2 sentences).

---

## Key Sections

- **Mission**: One-sentence goal
- **Context**: Background info
- **Tools**: What to use (in frontmatter)
- **Constraints**: What's off-limits
- **Output**: Expected result format

---

## Reference

- Full template: `blueprints/context-bundle-template.md`
- Testing: `guides/testing-subagents.md`

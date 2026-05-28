<!-- Context: openagents-repo/context-bundle-template | Priority: low | Version: 1.2 | Updated: 2026-05-13 -->

# Context Bundle Template

Template for delegating tasks to subagents.

## Purpose

Create context bundles in `.tmp/context/{session-id}/bundle.md` for subagent delegation.

---

## Template

```markdown
# Context Bundle: {Task Name}

Session: {session-id}
Created: {ISO timestamp}
For: {subagent-name}

## Task Overview

{Brief description}

## User Request

{Original request}

## Relevant Standards

- Code quality: `core/standards/code-quality.md`
- Test coverage: `core/standards/test-coverage.md`
- Security: `core/standards/security-patterns.md`

## Context Files

- `{context-file-1}`
- `{context-file-2}`

## Reference Files

- `{source-file-1}`

## Constraints

- {constraint 1}
- {constraint 2}

## Exit Criteria

- [ ] {completion condition 1}
- [ ] {completion condition 2}
```

---

## Reference

- Delegation: `core/workflows/task-delegation-basics.md`
- Task breakdown: `core/workflows/feature-breakdown.md`

<!-- Context: core/navigation | Priority: critical | Version: 1.1 | Updated: 2026-04-20 -->

# Context Navigation

**New here?** → `openagents-repo/quick-start.md`

---

## ⚡ MANDATORY: Remix 3 UI Standards

**All UI code MUST use css() mixins**. Never use `<style>` blocks or className props.

```
import { css } from 'remix/ui'

const style = css({ padding: '1rem', '&:hover': {} })
<div mix={style}>content</div>
```

Reference: `development/remix3/navigation.md`

---

## Structure

```
.opencode/context/
├── core/                   # Universal standards & workflows
├── openagents-repo/        # OpenAgents Control repository work
├── development/            # Software development (all stacks)
├── ui/                     # Visual design & UX
└── project-intelligence/   # Project-specific patterns & knowledge
```

---

## Quick Routes

| Task                 | Path                                       |
| -------------------- | ------------------------------------------ |
| **Write code**       | `core/standards/concepts/code-quality.md`           |
| **Write tests**      | `core/standards/concepts/test-coverage.md`          |
| **Write docs**       | `core/standards/concepts/documentation.md`          |
| **Review code**      | `core/workflows/guides/code-review.md`              |
| **Delegate task**    | `core/workflows/guides/task-delegation-basics.md`   |
| **Add agent**        | `openagents-repo/guides/adding-agent-basics.md`   |
| **UI development**   | `development/frontend/navigation.md`       |
| **API development**  | `development/backend/navigation.md`       |
| **Remix 3 patterns** | `project-intelligence/concepts/technical-domain.md` |

---

## By Category

**core/** - Standards, workflows, patterns → `core/navigation.md`
**openagents-repo/** - Repository-specific → `openagents-repo/navigation.md`
**development/** - All development → `development/navigation.md`
**ui/** - Design & UX → `ui/navigation.md`
**project-intelligence/** - Project-specific patterns → `project-intelligence/navigation.md`

---

## Project Intelligence

This repository includes Remix 3 monorepo-specific patterns:

| File/Folder                                | Description                                  | Version |
| ------------------------------------------ | -------------------------------------------- | ------- |
| `project-intelligence/concepts/technical-domain.md` | Tech stack, architecture, code patterns      | 1.8     |
| `project-intelligence/examples/bookstore-demo.md`   | Bookstore demo (CRUD, a11y, tests)           | 1.0     |
| `project-intelligence/sse/`                | SSE demo (offline messaging, E2E encryption) | -       |
| `project-intelligence/frame-navigation/`   | Frame navigation demo (admin patterns)       | -       |

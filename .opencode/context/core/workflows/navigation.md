<!-- Context: core/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Core Workflows Navigation

**Purpose**: Process workflows for common development tasks

---

## Guides

All workflows are organized as guides in `guides/`:

| File | Topic | Priority | Load When |
|------|-------|----------|-----------|
| `guides/code-review.md` | Code review process | ⭐⭐⭐⭐ | Reviewing code |
| `guides/task-delegation-basics.md` | Core delegation workflow | ⭐⭐⭐⭐ | Using task tool |
| `guides/task-delegation-specialists.md` | When to delegate to whom | ⭐⭐⭐⭐ | Choosing specialist |
| `guides/task-delegation-caching.md` | Context caching | ⭐⭐⭐ | Repeated tasks |
| `guides/external-libraries-workflow.md` | External library process | ⭐⭐⭐⭐ | External packages |
| `guides/external-libraries-scenarios.md` | Common scenarios | ⭐⭐⭐ | Examples needed |
| `guides/external-libraries-faq.md` | Troubleshooting | ⭐⭐⭐ | Errors/questions |
| `guides/feature-breakdown.md` | Breaking down features | ⭐⭐⭐⭐ | 4+ files, complex tasks |
| `guides/session-management.md` | Managing sessions | ⭐⭐⭐ | Session cleanup |
| `guides/design-iteration-overview.md` | Design workflow overview | ⭐⭐⭐⭐ | Starting design work |
| `guides/design-iteration-plan-file.md` | Design plan template | ⭐⭐⭐⭐ | Creating design plan |
| `guides/design-iteration-stage-layout.md` | Stage 1: Layout | ⭐⭐⭐ | Layout design |
| `guides/design-iteration-stage-theme.md` | Stage 2: Theme | ⭐⭐⭐ | Theme design |
| `guides/design-iteration-stage-animation.md` | Stage 3: Animation | ⭐⭐⭐ | Animation design |
| `guides/design-iteration-stage-implementation.md` | Stage 4: Implementation | ⭐⭐⭐ | Implementation |
| `guides/design-iteration-visual-content.md` | Visual content generation | ⭐⭐ | Image generation |
| `guides/design-iteration-best-practices.md` | Best practices & troubleshooting | ⭐⭐⭐ | Quality check |
| `guides/design-iteration-plan-iterations.md` | Plan file iterations | ⭐⭐⭐ | Managing iterations |

---

## Loading Strategy

**For code review**:
1. Load `guides/code-review.md` (high)
2. Depends on: `../standards/concepts/code-quality.md`, `../standards/concepts/security-patterns.md`

**For task delegation**:
1. Load `guides/task-delegation-basics.md` (high)
2. Load `guides/task-delegation-specialists.md` (when choosing agent)

**For external libraries**:
1. Load `guides/external-libraries-workflow.md` (high)
2. Reference `guides/external-libraries-scenarios.md` for examples

**For complex features**:
1. Load `guides/feature-breakdown.md` (high)
2. Depends on: `guides/task-delegation-basics.md`

**For session management**:
1. Load `guides/session-management.md` (medium)

---

## Related

- **Standards** → `../standards/navigation.md`
- **OpenAgents Control Delegation** → `../../openagents-repo/guides/subagent-invocation.md`

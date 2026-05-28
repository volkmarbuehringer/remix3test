<!-- Context: workflows/task-breakdown | Priority: high | Version: 2.1 | Updated: 2026-04-12 -->

# Task Breakdown Guidelines

Break down complex tasks into manageable subtasks.

## When to Use

- 4+ files involved
- Estimated effort >60 min
- Complex dependencies
- Multi-step coordination

---

## Process

1. **Scope**: Understand full requirement, constraints, end goal
2. **Phases**: Identify logical groupings, what depends on what
3. **Small Tasks**: Each task 1-2 hours max, independently completable
4. **Dependencies**: Clear prerequisite relationships
5. **Estimates**: Realistic time boxes

---

## Template

```
## Overview
What we're building, constraints

## Tasks (by Phase)
### Phase 1: Foundation
- [ ] Task 1 (1h) - depends on X
- [ ] Task 2 (2h)

### Phase 2: Feature
- [ ] Task 3 - depends on Phase 1
```

---

## Best Practices

- Keep tasks small (1-2h)
- Make dependencies explicit
- Include verification step
- Be realistic with estimates

---

## Reference

- Task management: `.opencode/skills/task-management/`
- Feature workflow: `guides/feature-breakdown.md`

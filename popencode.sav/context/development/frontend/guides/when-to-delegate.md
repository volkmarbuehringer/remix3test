<!-- Context: development/frontend/when-to-delegate | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# When to Delegate to Frontend Specialist

**Purpose**: Clear decision criteria for delegating UI/UX work to frontend-specialist subagent.

## Key Points

- **Delegate for**: New UI design, design systems, complex responsive layouts, animations, multi-stage iterations
- **Handle directly**: Simple HTML/CSS edits, bug fixes, content updates, single component updates
- **Always propose first** - show user the plan before delegating
- **Never delegate without user approval**
- **Provide context files** to load for the subagent

## Minimal Example

```javascript
// ✅ Delegate - requires design expertise
task(
  subagent_type="frontend-specialist",
  description="Create landing page design",
  prompt="Context: .opencode/context/ui/web/concepts/design-systems.md\nTask: Create hero section + features grid"
)

// ✅ Handle directly - simple edit
// <button>Change text</button>
```

## Decision Matrix

| Scenario | Action |
|----------|--------|
| New UI from scratch | Delegate |
| Design system work | Delegate |
| Complex responsive | Delegate |
| Animation work | Delegate |
| Simple HTML edit | Direct |
| Bug fix | Direct |
| Content update | Direct |

**Related**: `ui/web/concepts/design-systems.md`, `ui/web/concepts/ui-styling-standards.md`
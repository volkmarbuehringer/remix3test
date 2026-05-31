<!-- Context: standards/analysis | Priority: high | Version: 2.2 | Updated: 2026-05-18 -->

# Analysis Guidelines

**Core Concept**: Systematic code analysis framework — understand context, gather evidence, identify patterns, assess impact, recommend action. Output structured reports with prioritized findings.

---

## Analysis Process (5 Steps)

1. **Understand Context** — What, why, scope, constraints
2. **Gather Information** — Read code, docs, issues, dependencies
3. **Identify Patterns** — Consistent vs inconsistent conventions
4. **Assess Impact** — Implications, trade-offs, risks
5. **Provide Recommendations** — What, why, alternatives, priority

---

## Report Format

```markdown
## Analysis: {Topic}
**Context:** {What and why}
**Findings:** {Key findings}
**Patterns:** {Observed conventions}
**Issues:** 🔴 Critical | 🟡 Warning | 🔵 Suggestion
**Recommendations:** {What + why}
**Trade-offs:** {Approach A vs B}
**Next Steps:** {Actions}
```

---

## Analysis Types

| Type | Focus |
|------|-------|
| Code Quality | Complexity, duplication, coverage, naming, error handling |
| Architecture | Coupling, cohesion, separation of concerns, bottlenecks |
| Bug Investigation | Reproduce → root cause → impact → fix → edge cases |
| Pattern Discovery | Find implementations, identify conventions, standardize |

---

## Key Points

- **Be Thorough**: Check multiple examples, consider edge cases
- **Be Objective**: Evidence-based, avoid assumptions
- **Be Specific**: File names, line numbers, code snippets
- **Be Actionable**: Clear recommendations with rationale

**Reference**: See also `code-quality.md`, `documentation.md`

---

## Debug Lessons

### Lesson: When Debugging Frame Rendering Errors, Verify the Exact URL and Target Frame

The error `Node.insertBefore: Cannot have more than one Element child of a Document` can come from multiple root causes. Before fixing, diagnose systematically:

**Step 1: Check the URL in the browser's network tab**
- Is it a fragment endpoint (returns partial HTML)?
- Full-page routes returning full HTML documents are safe for top frames
- Fragment endpoints returning partial HTML with `<head>` wrapper will crash the top frame

**Step 2: Identify which frame is loading the URL**
- Top frame (parent = `document`) → fragment HTML with `<head>` wrapper will crash
- Sub-frame (parent = regular `Element` like `<div>`) → same fragment HTML works fine
- Check `container.root instanceof Document` to distinguish

**Step 3: Check the link/trigger for `rmx-target`**
- Links inside sub-Frames without `rmx-target` default to `topFrame` — always a bug
- Links inside top-level frames without `rmx-target` work fine (the frame IS the Document)

**Step 4: Check `finalizeHtml` behavior**
- When `flushKind !== 'document'`, `finalizeHtml()` prepends `<head>` with styles
- This is safe for sub-frames but deadly for top-frame Document rendering
- The `<head>` wrapper becomes an Element child of Document, conflicting with `<html>`

**Step 5: Distinguish server-rendered vs dynamically navigated frames**
- Server-rendered sub-frames (SSR via `buildFrameSegment`): safe — bounded by comment markers, Element parent
- Dynamically navigated top frame (via navigation intercept): unsafe — fragment HTML diffed against Document

**Common pitfall**: Fixing the wrong controller. The URL that errors may be one thing, but the actual problematic link might be in a different part of the app. Always trace back to the source of the navigation, not just the URL being loaded.

**Related**: `errors/fragment-navigates-top-frame.md`, `errors/frame-reload-crash.md`

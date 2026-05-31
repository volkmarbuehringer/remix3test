<!-- Context: openagents-repo/plugins/context/capabilities/events_skills | Priority: low | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Skills Plugin Event Hooks

**Core Idea**: The Skills Plugin uses event hooks (`tool.execute.before` and `tool.execute.after`) to inject skill content into conversations and enhance tool output, following separation of concerns principles.

**Key Points**:
- `tool.execute.before`: Injects skill content as silent prompt before tool runs (O(1) lookup via Map)
- `tool.execute.after`: Adds emoji titles to output after tool completes
- Hooks filter by tool name prefix (`skills_`) to identify skill tools
- Use `noReply: true` to inject without triggering AI response
- SkillMap enables O(1) access vs O(n) array search

**Quick Example**:
```typescript
// Before hook - inject skill content
const beforeHook = async (input, output) => {
  if (input.tool.startsWith("skills_")) {
    const skill = skillMap.get(input.tool)  // O(1) lookup
    await ctx.client.session.prompt({
      path: { id: input.sessionID },
      body: { agent: input.agent, noReply: true, parts: [{ type: "text", text: skill.content }] }
    })
  }
}

// After hook - enhance output
const afterHook = async (input, output) => {
  if (input.tool.startsWith("skills_") && output.output) {
    output.title = `📚 ${skillMap.get(input.tool).name}`
  }
}
```

**Reference**: `context/capabilities/events.md`

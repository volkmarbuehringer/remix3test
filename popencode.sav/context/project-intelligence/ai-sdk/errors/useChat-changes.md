---
title: useChat Changes
description: Breaking changes in useChat hook and how to migrate.
---

# Error: useChat Breaking Changes

**Core Idea**: AI SDK 6+ removed managed input state in `useChat`. You must now manage input manually with `useState` and use the new transport/API patterns.

## Key Points

- No more `input`, `handleInputChange`, `handleSubmit` - use manual state + `sendMessage`
- `api` prop replaced with `transport: new DefaultChatTransport({ api })`
- Tool parts renamed: `tool-invocation` → `tool-{toolName}`
- Tool state renamed: `partial-call` → `input-streaming`, `call` → `input-available`, `result` → `output-available`

## Old → New Patterns

### Input State (Required Change)

```tsx
// ❌ Old - deprecated
const { input, handleInputChange, handleSubmit } = useChat({ api: '/api/chat' });

// ✅ New - required
const [input, setInput] = useState('');
const { sendMessage } = useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) });

const handleSubmit = e => {
  e.preventDefault();
  sendMessage({ text: input });
  setInput('');
};
```

### Tool Part Types

```tsx
// ❌ Old - deprecated
case 'tool-invocation':
  return JSON.stringify(part.toolInvocation);

// ✅ New - typed per tool
case 'tool-weather':
  return <WeatherTool invocation={part} />;
```

### Tool State Names

```tsx
// ❌ Old - deprecated
switch (part.toolInvocation.state) {
  case 'partial-call': // → input-streaming
  case 'call':         // → input-available
  case 'result':       // → output-available
}

// ✅ New
switch (part.state) {
  case 'input-streaming':
  case 'input-available':
  case 'output-available':
}
```

### Property Names

| Old | New |
|-----|-----|
| `part.toolInvocation.args` | `part.input` |
| `part.toolInvocation.result` | `part.output` |
| `part.toolInvocation.toolCallId` | `part.toolCallId` |

### State-Dependent Access

```tsx
// ❌ TS error - input may be undefined
part.input.location

// ✅ Check state first
if (part.state === 'input-available' || part.state === 'output-available') {
  const location = part.input.location;
}

// ❌ TS error - output may be undefined  
part.output

// ✅ Only access in output-available state
if (part.state === 'output-available') {
  const result = part.output;
}
```

## Response Format

```tsx
// ❌ Old - deprecated
return result.toDataStreamResponse();

// ✅ New - for useChat
return result.toUIMessageStreamResponse();
```

## Reference

- Full migration: See navigation.md for overview
- See also: [guides/type-safe-agents.md](../guides/type-safe-agents.md)
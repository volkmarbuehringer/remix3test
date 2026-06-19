---
name: remix-demos
description: Reference implementations from the Remix demo projects. Activate when looking for real-world patterns for bookstore CRUD, authentication, SSE, frames, navigation, or asset serving.
---

# Remix Demo Applications

Full working apps in `~/remix/demos/`. Each demonstrates a complete Remix pattern.

## Available Demos

| Demo | Pattern | Reference Path |
|------|---------|---------------|
| **bookstore** | CRUD with forms, search, data layer | `~/remix/demos/bookstore/` |
| **frame-navigation** | Frame-based navigation and content loading | `~/remix/demos/frame-navigation/` |
| **frames** | Component frames, layout composition | `~/remix/demos/frames/` |
| **social-auth** | OAuth/OIDC login flow | `~/remix/demos/social-auth/` |
| **sse** | Server-Sent Events streaming | `~/remix/demos/sse/` |
| **timeboxer** | Timer and scheduling UI | `~/remix/demos/timeboxer/` |
| **unpkg** | Asset proxying and serving | `~/remix/demos/unpkg/` |
| **assets** | Asset pipeline and browser module serving | `~/remix/demos/assets/` |

## How to Use

Each demo is a standalone Remix app. Study the router setup, action structure, middleware stack, and route contract for real-world patterns. Copy relevant patterns into your app rather than the full project structure.

## References

- `~/remix/demos/<demo-name>/` — demo source code
- `~/remix/packages/` — corresponding package READMEs for deeper API docs

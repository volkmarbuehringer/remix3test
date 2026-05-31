<!-- Context: openagents-repo/context-overview | Priority: low | Version: 1.0 | Updated: 2026-02-15 -->

# OpenCode Plugin Context Library

This library provides structured context for AI coding assistants to understand, build, and extend OpenCode plugins. Depending on your task, you can load specific parts of this library.

## 📚 Library Map

### 🏗️ Architecture
Foundational concepts of how plugins are registered and executed.
- [Overview](./architecture/overview.md): Basic structure, registration, and context object.
- [Lifecycle](./architecture/lifecycle.md): Packaging, manifest, and session lifecycle.

### 🛠️ Capabilities
Deep dives into specific plugin features.
- [Events](./capabilities/events.md): Detailed list of all 25+ hookable events.
- [Events: Skills Plugin](./capabilities/events_skills.md): Practical example of event hooks in the Skills Plugin.
- [Tools](./capabilities/tools.md): How to build and register custom tools using Zod.
- [Agents](./capabilities/agents.md): Creating and configuring custom AI agents.

### 📖 Reference
Guidelines and troubleshooting.
- [Best Practices](./reference/best-practices.md): Message injection workarounds, security, and performance.

### 🧩 Claude Code Plugins (External)
Claude Code plugin system documentation (harvested from external docs).
> **Note**: Plugin-specific sub-files below have not yet been extracted. External source: Claude Code plugin docs.
- Concepts: Plugin Architecture — core concepts and structure *(not yet extracted)*
- Guides: Creating Plugins — step-by-step creation *(not yet extracted)*
- Guides: Migrating to Plugins — convert standalone to plugin *(not yet extracted)*
- Lookup: Plugin Structure — directory reference *(not yet extracted)*

## 🚀 How to use this library
If you are asking an AI to build a new feature:
1. **For a new tool**: Provide `architecture/overview.md` and `capabilities/tools.md`.
2. **For reacting to events**: Provide `capabilities/events.md`.
3. **For overall plugin architecture**: Provide `architecture/overview.md` and `architecture/lifecycle.md`.

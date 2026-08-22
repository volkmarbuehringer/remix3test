---
name: dsh-skill-migration
description: "Use when importing opencode commands or Claude Code agents into this harness, or when a skill added to .agents/skills/ isn't discovered — harness skill roots, required frontmatter, and the migration transforms."
metadata:
  origin: auto-extracted
---

# DeepSeek Harness Skill Migration

**Extracted:** 2026-08-22
**Context:** Migrating everything-claude-code commands/agents into the DeepSeek Harness (DSH) web GUI; verified against dsh-skill-filesystem source.

## Problem

opencode `/`-commands and Claude Code `@`-agents are markdown+YAML-frontmatter files that don't load in this harness as-is, and a converted skill can be silently ignored (no error) when its frontmatter misses a required field. There is no markdown command loader and no named-subagent registry — **skills are the only import mechanism**.

## Solution

### Discovery (what the harness scans)

| Root | Rank |
|---|---|
| `<project>/.dsh/skills` | 100 |
| `<project>/.agents/skills` | 200 |
| `~/.dsh/skills` | 400 |
| `~/.agents/skills` | 500 |

Accepted shapes: `<root>/<name>/SKILL.md` (bundle) **or** flat `<root>/<name>.md` — no deeper nesting. Symlinks are followed.

### Frontmatter requirements (silent-ignore traps)

- `name` (kebab-case, must equal the directory name) and `description` are **both required** — missing either → the skill is ignored with only a log warning. This is why converted opencode commands (which only carry `description:`) vanish from the catalog until `name:` is added.
- Unknown keys are tolerated (`tools:`, `model:`, `allowed_tools:`, `argument-hint:`, `metadata:`) — safe to leave or strip.
- Legacy camelCase invocation keys are **rejected loudly**: `disableModelInvocation`, `modelInvocable`, `userInvocable` → use `disable-model-invocation` / `user-invocable`.
- `user-invocable: false` → user-only skill (reachable via the `/` menu, never model-invoked).

### Migration transforms (opencode command / Claude Code agent → skill)

1. Add `name: <kebab-case>` (= target directory name) — command files rarely have it.
2. Keep `description:` (drives the catalog + auto-load).
3. Strip agent-only frontmatter keys: `tools:`, `model:`, `mode:`, `temperature:`, `agent:`.
4. Replace `$ARGUMENTS` with "the user's request".
5. Adapt hardcoded foreign paths (`~/.claude/...`, `.claude/skills/`) to harness roots (`~/.agents/skills/`, `.agents/skills/`).

### Live behavior

- The filesystem watcher picks up new/changed skills **mid-session** — the catalog refreshes without a restart (symlinks followed, ~200ms stability).
- The GUI `/` menu lists skills; a name colliding with a host **command** resolves to the command.

### Re-runnable converter

Keep a script (pattern: `scripts/convert-ecc-skills.ts`) that converts a whole agent/command set, with: a `SKIP` set for manually-adapted pilots, an `INCLUDE_COMMANDS` whitelist of portable commands, and a `SKIP_COMMANDS` set for infra-bound ones (hookify/instinct/epic/orch/multi/loops). Re-run after each upstream `git pull`.

## When to Use

- User asks to bring opencode commands, Claude Code agents, or a skill collection into this harness.
- A skill you just added doesn't appear in the `/` menu — check `name:`/`description:`/kebab-case first.
- After `git pull`-ing an upstream skill repo, to refresh the converted set.

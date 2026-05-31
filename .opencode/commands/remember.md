---
description: Save a successful fix or solution as project knowledge with auto-tagging and instinct creation.
---

# Remember Command

Save a successful fix, solution, or reusable pattern from the current session: $ARGUMENTS

## Your Task

Analyze the recent conversation and code changes to extract the key fix or solution.

### Step 1: Extract

Identify:
1. **Problem** — what was broken or what needed solving
2. **Solution** — the code, config, or steps that fixed it
3. **Why** — why this solution works (context, not just copy-paste)

### Step 2: Auto-Tag

Generate tags based on:
- File paths touched (e.g., `app/actions/admin-offerings-controller.tsx` → `admin`, `offerings`)
- Error messages or keywords in the discussion (e.g., `exclusion constraint`, `CSRF`, `hydration`)
- Framework/domain keywords (e.g., `remix3`, `postgres`, `auth`)

### Step 3: Write Knowledge File

Create a markdown file at `.agents/knowledge/<auto-slug>.md` with YAML frontmatter:

```yaml
---
title: "<descriptive title>"
tags: [auto, generated, tags]
created: $(date +%Y-%m-%d)
status: active
---
```

The body should contain:
- `## Problem` — what went wrong
- `## Solution` — the fix with code examples
- `## Why` — reasoning so it's not cargo-culted

### Step 4: Create Instinct

Also create an instinct YAML file in the continuous-learning-v2 homunculus directory to make the knowledge visible in `/instinct-status` and `/evolve`.

**Determine the project context:**
1. Run `git rev-parse --show-toplevel` to find the project root
2. Compute the project hash and find the instincts directory under `~/.local/share/ecc-homunculus/projects/<hash>/instincts/personal/`
3. If the directory doesn't exist, create it

**Instinct file format:**
```yaml
---
id: <auto-slug>
trigger: "when [describes the situation that triggers this knowledge]"
confidence: 0.9
domain: "knowledge"
source: "user-curated"
scope: project
project_id: "<hash>"
project_name: "<project-name>"
---

# <Title>

## Action
<concise action description>

## Evidence
- Saved as project knowledge by /remember
```

### Step 5: Confirm

Show the user what was saved:
- Knowledge file path
- Tags assigned
- Instinct created
- Suggestion to add tags to `.agents/knowledge-config.json`'s `auto_load_tags` for automatic loading

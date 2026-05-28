# /context Command

Context Manager for organizing knowledge files following Project Intelligence standards.

## Overview

The `/context` command helps you manage context files by:

- Harvesting knowledge from AI summaries
- Extracting patterns from documentation
- Organizing files into function-based structure
- Validating MVI compliance
- Migrating between global and local context

## Installation

The script is located at `.opencode/bin/context.ts` and can be run with Node.js:

```bash
node .opencode/bin/context.ts [operation] [args]
```

Or make it available as a command:

```bash
alias context="node .opencode/bin/context.ts"
```

## Operations

### Quick Scan (Default)

```bash
/context
```

Scans workspace for summary files and suggests actions.

### Harvest

```bash
/context harvest              # Scan entire workspace
/context harvest .tmp/        # Scan specific directory
/context harvest OVERVIEW.md  # Harvest specific file
```

Extracts knowledge from summary files and moves them to permanent context.

**6-Stage Workflow:**

1. **Scan** - Find summary files (_.md in .tmp/, OVERVIEW.md, SESSION-_.md)
2. **Analyze** - Categorize content by function (concepts, examples, guides, errors, lookup)
3. **Approve** - Interactive approval with letter-based selection
4. **Extract** - Create MVI-compliant context files
5. **Cleanup** - Archive or delete source files
6. **Report** - Show results summary

### Extract

```bash
/context extract from docs/api.md
/context extract from https://example.com/docs
```

Extract knowledge from documentation, code, or URLs.

### Organize

```bash
/context organize development/
```

Restructure flat files into function-based folders.

### Map

```bash
/context map                  # Show all categories
/context map development      # Show specific category
```

Display current context structure.

### Validate

```bash
/context validate
```

Check context files for:

- MVI compliance (<200 lines)
- HTML frontmatter presence
- Proper structure

### Migrate

```bash
/context migrate
```

Copy context from global (`~/.config/opencode/context/`) to local (`.opencode/context/`).

## File Structure

Context files follow function-based organization:

```
.opencode/context/{category}/
├── navigation.md           # Navigation and loading strategy
├── concepts/               # What it is (definitions, patterns)
├── examples/               # Working code (<30 lines)
├── guides/                 # How to do it (workflows)
├── lookup/                 # Quick reference (tables, commands)
└── errors/                 # Common issues and fixes
```

## MVI Principle

All context files follow Minimal Viable Information:

- **Core concept**: 1-3 sentences
- **Key points**: 3-5 bullets
- **Example**: <10 lines of code
- **Reference**: Link to full docs
- **File size**: <200 lines
- **Scannable**: <30 seconds

## Standards

### HTML Frontmatter (Required)

```markdown
<!-- Context: development/auth | Priority: critical | Version: 1.0 | Updated: 2026-01-15 -->
```

### File Size Limits

- Concepts: max 100 lines
- Examples: max 80 lines
- Guides: max 150 lines
- Lookup: max 100 lines
- Errors: max 150 lines

## Safety Features

1. **Approval Gate** - Never auto-deletes without confirmation
2. **Archive by Default** - Moves to `.tmp/archive/` instead of permanent delete
3. **Letter-Based Selection** - Approve specific items (A B C) or "all"
4. **Validation** - Checks file sizes and structure
5. **Preview** - Shows what will happen before doing it

## Examples

### Harvest Session Files

```bash
# After AI session creates SESSION-auth-work.md
/context harvest SESSION-auth-work.md

# Output:
# Found 3 items:
#   [A] Error: JWT expiration not handled
#   [B] Example: Refresh token implementation
#   [C] Pattern: Token storage strategy
#
# Approve? A B C
# ✓ Extracted to development/errors/auth-errors.md
# ✓ Extracted to development/examples/jwt-refresh.md
# ✓ Extracted to development/concepts/token-storage.md
# ✓ Archived SESSION-auth-work.md
```

### View Context Map

```bash
/context map development

# Output:
# 📁 development/
#   concepts/: 5 files
#     • authentication.md
#     • authorization.md
#     ...
#   examples/: 3 files
#   guides/: 2 files
#   errors/: 4 files
```

### Validate Before Commit

```bash
/context validate

# Output:
# ✅ All context files are valid!
#
# Or:
# ⚠️  Found 2 issues:
#   • development/concepts/auth.md: 245 lines (max 200)
#   • development/examples/jwt.md: Missing HTML frontmatter
```

## Related

- `.opencode/context/core/context-system/standards/mvi.md` - MVI principle
- `.opencode/context/core/context-system/standards/structure.md` - Folder structure
- `.opencode/context/core/context-system/operations/harvest.md` - Harvest workflow

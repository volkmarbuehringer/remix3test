<!-- Context: core/harvest | Priority: medium | Version: 1.1 | Updated: 2026-04-02 -->

# Context Harvest Operation

**Purpose**: Extract knowledge from AI summary files → permanent context, then clean workspace.

## Key Points

- AI creates summary files (OVERVIEW.md, SESSION-*.md) that contain valuable knowledge but clutter workspace
- Harvest workflow: Scan → Analyze → Approve → Extract → Cleanup → Report
- Auto-detect patterns: *OVERVIEW.md, *SUMMARY.md, SESSION-*.md, files in .tmp/
- Always show approval UI before extracting/deleting (NEVER auto-harvest without confirmation)
- Apply MVI to extracted content: Core concept (1-3 sentences), key points (3-5 bullets), minimal example (<10 lines)
- Archive by default: Move to `.tmp/archive/harvested/{date}/`, not permanent delete

## 6-Stage Workflow

1. **Scan**: Find all summary files (check .tmp/, look for patterns)
2. **Analyze**: Categorize content (design decisions→concepts/, solutions→examples/, workflows→guides/, errors→errors/)
3. **Approve**: Present UI with letter-based selection, wait for user input
4. **Extract**: Apply MVI to approved items, write to target files
5. **Cleanup**: Archive or delete source files (user choice)
6. **Report**: Show created files, disk space freed, navigation updates

## Usage

```bash
/context harvest              # Scan entire workspace
/context harvest .tmp/        # Scan specific directory
/context harvest OVERVIEW.md  # Harvest specific file
```

## Smart Detection

✅ Extract: Design decisions, patterns that worked, errors+solutions, core concepts
❌ Skip: Planning discussion, conversational notes, duplicate info, TODO lists

**Reference**: Full guide at `.opencode/context/core/context-system/operations/harvest.md`

**Related**: `compact.md`, `mvi-principle.md`, `structure.md`
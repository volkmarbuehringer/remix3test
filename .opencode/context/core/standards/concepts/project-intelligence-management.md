<!-- Context: standards/intelligence-mgmt | Priority: high | Version: 1.1 | Updated: 2026-04-12 -->

# Project Intelligence Management

Manage project intelligence files in `.opencode/context/`.

## Quick Reference

| Action | Do This |
| -------- | --------- |
| Update | Edit + bump frontmatter version |
| Add new | Create `.md` + add to navigation.md |
| Add folder | Create folder + `navigation.md` |
| Remove | Rename `.deprecated.md`, don't delete |

---

## Update Process

1. Edit the file
2. Update frontmatter version:
```html
<!-- Context: {cat} | Priority: {level} | Version: {X.Y} | Updated: {YYYY-MM-DD} -->
```
3. Keep under 200 lines (MVI)
4. Commit with descriptive message

---

## Add New File

1. Create `.md` in appropriate folder
2. Follow MVI format (core concept, key points, minimal example)
3. Add to `navigation.md` in same folder

---

## Reference

- MVI principle: `context-system/standards/mvi.md`
- Structure: `context-system/standards/structure.md`

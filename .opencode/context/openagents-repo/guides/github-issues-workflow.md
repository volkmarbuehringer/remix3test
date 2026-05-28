<!-- Context: openagents-repo/guides/github-issues-workflow | Priority: high | Version: 2.0 | Updated: 2026-03-27 -->

# Guide: GitHub Issues and Project Board Workflow

**Prerequisites**: Basic understanding of GitHub issues and projects

**Core Idea**: Step-by-step workflow for creating issues, adding to project board, processing, and tracking progress through states (Backlog → Todo → In Progress → In Review → Done).

**Key Points**:
- Labels: `feature`, `bug`, `enhancement`, `priority-high/medium/low`
- Project board: https://github.com/users/darrenhinde/projects/2/views/2
- Use `gh` CLI for automation
- Reference issues in PRs with "Closes #NUMBER"

**Quick Commands**:
```bash
# Create issue
gh issue create --repo darrenhinde/OpenAgentsControl --title "Title" --body "Body" --label "feature"

# Add to project
gh project item-add 2 --owner darrenhinde --url https://github.com/darrenhinde/OpenAgentsControl/issues/NUMBER

# Assign
gh issue edit NUMBER --add-assignee @me

# Create PR with issue reference
gh pr create --title "Fix #NUMBER: Description" --body "Closes #NUMBER"
```

**Workflow States**: Backlog → Todo → In Progress → In Review → Done

**Reference**: https://docs.github.com/en/issues

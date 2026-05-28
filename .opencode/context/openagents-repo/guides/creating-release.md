<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Guide: Creating a Release

**Purpose**: Step-by-step workflow for creating a new release.

## Key Points

- Semantic versioning: MAJOR.MINOR.PATCH (breaking/feature/fix)
- Update VERSION, package.json, and CHANGELOG
- Commit + tag + push + create GitHub release

## Quick Steps

```bash
# 1. Update version
echo "0.X.Y" > VERSION
jq '.version = "0.X.Y"' package.json > tmp && mv tmp package.json

# 2. Update CHANGELOG (manual)

# 3. Commit and tag
git add VERSION package.json CHANGELOG.md
git commit -m "chore: bump version to 0.X.Y"
git tag -a v0.X.Y -m "Release v0.X.Y"

# 4. Push
git push origin main
git push origin v0.X.Y

# 5. Create GitHub release
gh release create v0.X.Y --title "v0.X.Y" --notes "See CHANGELOG.md"
```

## Checklist

- [ ] All tests pass
- [ ] Registry validates
- [ ] VERSION updated
- [ ] package.json updated  
- [ ] CHANGELOG updated
- [ ] Changes committed
- [ ] Tag created
- [ ] Pushed to GitHub
- [ ] GitHub release created
- [ ] Installation tested

## Common Issues

| Issue | Solution |
|-------|----------|
| Version mismatch | Update both VERSION and package.json |
| Tag already exists | `git tag -d v0.X.Y` + recreate |
| Push rejected | `git pull origin main` first |

**Reference**: Full guide at `.opencode/context/openagents-repo/guides/creating-release.md`

**Related**: `scripts/versioning/bump-version.sh`, `lookup/commands.md`
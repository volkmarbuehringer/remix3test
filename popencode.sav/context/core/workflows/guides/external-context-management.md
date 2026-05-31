<!-- Context: workflows/external-context | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# External Context Management

**Purpose**: Managing live documentation fetched from external libraries (via Context7 API) - persist to avoid re-fetching.

## Key Points

- ExternalScout fetches once → persists to `.tmp/external-context/` → main agents reference → subagents read (no re-fetching)
- Directory: `.tmp/external-context/{package-name}/{topic}.md` (package names in kebab-case)
- Manifest: `.tmp/external-context/.manifest.json` - tracks what's cached, when fetched, source
- Each file has metadata header: source, library, package, topic, fetched timestamp, official_docs link
- Clean up when: task complete, docs stale (>7 days), user requests, disk space needed

## Directory Structure

```
.tmp/external-context/
├── .manifest.json
├── drizzle-orm/
│   ├── modular-schemas.md
│   └── postgresql-setup.md
├── better-auth/
│   └── nextjs-integration.md
└── next.js/
    └── app-router-setup.md
```

## Minimal Example

```json
// .manifest.json
{
  "last_updated": "2026-04-02T10:00:00Z",
  "packages": {
    "drizzle-orm": {
      "files": ["modular-schemas.md"],
      "source": "Context7 API"
    }
  }
}
```

**Reference**: Full guide at `.opencode/context/core/workflows/guides/external-context-management.md`

**Related**: `external-context-integration.md`, `task-delegation-basics.md`
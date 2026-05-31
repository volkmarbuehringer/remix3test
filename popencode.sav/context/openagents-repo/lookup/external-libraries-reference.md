<!-- Context: openagents-repo/lookup/external-libraries | Priority: high | Version: 1.0 | Updated: 2026-01-29 -->
# Lookup: Common Packages in OpenAgents

**Purpose**: Quick reference for external libraries used in this repository

---

## Package Reference

| Package | Use Case | Priority | Notes |
|---------|----------|----------|-------|
| **Drizzle ORM** | Database schemas & queries | ⭐⭐⭐⭐⭐ | Modular schema patterns |
| **Better Auth** | Authentication & authorization | ⭐⭐⭐⭐⭐ | Full auth solution |
| **Next.js** | Full-stack web framework | ⭐⭐⭐⭐⭐ | App Router pattern |
| **TanStack Query** | Server state management | ⭐⭐⭐⭐ | React Query v5 |
| **TanStack Router** | Type-safe routing | ⭐⭐⭐⭐ | File-based routing |
| **TanStack Start** | SSR framework | ⭐⭐⭐⭐ | TanStack + Remix |
| **Zod** | Schema validation | ⭐⭐⭐⭐ | Type inference |
| **Tailwind CSS** | Styling | ⭐⭐⭐⭐ | Utility-first |
| **Shadcn/ui** | UI components | ⭐⭐⭐ | Copy-paste components |
| **Radix UI** | Headless UI primitives | ⭐⭐⭐ | Accessible components |
| **Zustand** | Client state management | ⭐⭐⭐ | Lightweight store |
| **Jotai** | Atomic state | ⭐⭐⭐ | Granular updates |
| **Vitest** | Testing framework | ⭐⭐⭐ | Vite-native tests |
| **Playwright** | E2E testing | ⭐⭐⭐ | Cross-browser |
| **Cloudflare Workers** | Edge runtime | ⭐⭐⭐ | Serverless functions |
| **AWS Lambda** | Cloud functions | ⭐⭐⭐ | Serverless |
| **Vercel** | Deployment platform | ⭐⭐⭐ | Edge functions |

---

## Why Version-Specific Docs Matter

**Example**: Next.js Evolution
```
Training data (2023): Next.js 13 uses pages/ directory
Current (2025): Next.js 15 uses app/ directory (App Router)
```

**Real Impact**:
- APIs change (new methods, deprecated features)
- Configuration patterns evolve
- Breaking changes happen frequently
- Version-specific features differ

---

## Fetching Documentation

Use ExternalScout for version-specific docs:

```bash
# Drizzle ORM
task(ExternalScout, "Fetch Drizzle ORM docs for modular schema patterns")

# Better Auth
task(ExternalScout, "Fetch Better Auth docs for authentication setup")

# Next.js
task(ExternalScout, "Fetch Next.js 15 docs for App Router patterns")
```

---

## Related

- `../guides/external-libraries-workflow.md` - Full workflow guide

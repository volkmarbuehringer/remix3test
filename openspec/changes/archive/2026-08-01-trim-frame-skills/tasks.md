## 1. Delete remix-fetch-proxy

- [x] 1.1 Remove `.opencode/skills/learned/remix-fetch-proxy/` directory
- [x] 1.2 Update `AGENTS.md` specialized-skills list to point fetch-proxy coverage at the vendor `remix` skill and fetch-proxy README
- [x] 1.3 Verify no other skill references `remix-fetch-proxy` by name

## 2. Trim remix-file-uploads

- [x] 2.1 Remove generic multipart/limits/storage sections (lines 10–54) and replace with a pointer to `multipart-parser`, `form-data-middleware`, `file-storage` READMEs
- [x] 2.2 Keep the PostgreSQL `bytea` backend section verbatim (middleware-ordering gotcha, download endpoint, void-handler trick)
- [x] 2.3 Verify the skill still reads coherently top-to-bottom

## 3. Deduplicate remix3-frame-cliententry

- [x] 3.1 Merge "Binary File Downloads in Frames" and "Cross-Section Navigation CPU Loop" into one `rmx-document` section; keep crash/loop symptoms and `X-Remix-Frame` 302 guard; ensure the `rmx-document` fact appears once
- [x] 3.2 Trim "on Mixin Requires clientEntry" to the "compiles but never fires" diagnostic and Document-vs-Layout mount placement
- [x] 3.3 Remove the off-topic "Mobile Nav Hamburger" section
- [x] 3.4 Verify all unique frame sections remain (form interception, cascade limit, mounted guard, reloadComplete, CSS child selectors, inline-edit, drag/drop, fragment scrolling, test verification, target registration, input value preservation, direct render)

## 4. Trim remix3-standalone-route-admin-sidebar

- [x] 4.1 Remove §4 (client IP with `trustProxy: true`) and replace with a pointer to `remix3-two-tier-ip-trust-model`
- [x] 4.2 Trim §1 and §5 to pointers to guide 02 / guide 04
- [x] 4.3 Keep §2 (`iframeNav: false`) and §3 (SSE-401 `requireSseAuth()`) verbatim

## 5. Merge remix3-multiple-route-trees into remix-cli-devops

- [x] 5.1 Add the CLI-discovery limitation note (multiple named route-tree exports invisible to `remix routes`) to `remix-cli-devops/SKILL.md`
- [x] 5.2 Remove `.opencode/skills/learned/remix3-multiple-route-trees/` directory
- [x] 5.3 Update `AGENTS.md` list if it names `remix3-multiple-route-trees`

## 6. Trim remix-routepattern-opaque-access

- [x] 6.1 Keep the migration warning and `.source.replace(...)` rewrite technique
- [x] 6.2 Replace the public API table with a pointer to the route-pattern README

## 7. Final verification

- [x] 7.1 Confirm only the intended skills changed (the three unique skills untouched)
- [x] 7.2 Verify no dangling cross-references to removed skills (grep `remix-fetch-proxy`, `remix3-multiple-route-trees`)
- [x] 7.3 Confirm `AGENTS.md` specialized-skills list matches reality

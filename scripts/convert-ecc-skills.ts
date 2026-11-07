/**
 * Convert everything-claude-code agents/commands (~/ECC) into harness skills.
 *
 * Re-runnable after `git pull` in ~/ECC: re-run to refresh converted skills.
 * Existing pilot skills (code-reviewer, architect, learn-eval) are skipped —
 * they carry manual harness adaptations.
 *
 * Usage: node scripts/convert-ecc-skills.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const HOME = process.env.HOME
if (!HOME) {
  throw new Error('HOME is not set; cannot locate the ECC checkout')
}
const SRC = path.join(HOME, 'ECC')
const DST = path.join(process.cwd(), '.agents/skills')

/**
 * Frontmatter keys that describe a Claude Code slash command rather than a
 * harness skill. ECC's own portable allowlist is `name`, `description`,
 * `allowed-tools`, `license`, `metadata` (see
 * `scripts/ci/validate-skill-host-compat.js` in the ECC checkout); everything
 * below that list is harness-inert at best and misleading at worst.
 */
const HARNESS_FRONTMATTER_KEYS = ['name', 'description', 'allowed-tools', 'license', 'metadata']

const SKIP = new Set(['code-reviewer', 'architect', 'learn-eval'])

/** Commands that are ECC-infrastructure-bound and not portable as harness skills. */
const SKIP_COMMANDS = new Set([
  'auto-update',
  'cost-report',
  'ecc-guide',
  'epic-claim',
  'epic-decompose',
  'epic-publish',
  'epic-review',
  'epic-sync',
  'epic-unblock',
  'epic-validate',
  'evolve',
  'harness-audit',
  'hookify',
  'hookify-configure',
  'hookify-help',
  'hookify-list',
  'instinct-export',
  'instinct-import',
  'instinct-status',
  'jira',
  'loop-start',
  'loop-status',
  'marketing-campaign',
  'model-route',
  'multi-backend',
  'multi-execute',
  'multi-frontend',
  'multi-plan',
  'multi-workflow',
  'orch-add-feature',
  'orch-build-mvp',
  'orch-change-feature',
  'orch-fix-defect',
  'orch-refine-code',
  'orch-review',
  'plan-canvas',
  'project-init',
  'projects',
  'promote',
  'prune',
  'quality-gate',
  'resume-session',
  'save-session',
  'security-scan',
  'sessions',
  'skill-health',
])

/** Commands that convert (standalone workflows; language build/review/test bundles). */
const INCLUDE_COMMANDS = [
  'aside',
  'build-fix',
  'checkpoint',
  'code-review',
  'cpp-build',
  'cpp-review',
  'cpp-test',
  'fastapi-review',
  'feature-dev',
  'flutter-build',
  'flutter-review',
  'flutter-test',
  'gan-build',
  'gan-design',
  'go-build',
  'go-review',
  'go-test',
  'gradle-build',
  'issue-review',
  'kotlin-build',
  'kotlin-review',
  'kotlin-test',
  'learn',
  'plan',
  'plan-prd',
  'pm2',
  'pr',
  'prp-commit',
  'prp-implement',
  'prp-plan',
  'prp-prd',
  'prp-pr',
  'python-review',
  'react-build',
  'react-review',
  'react-test',
  'refactor-clean',
  'review-pr',
  'rust-build',
  'rust-review',
  'rust-test',
  'santa-loop',
  'setup-pm',
  'skill-create',
  'skill-host-compat',
  'test-coverage',
  'token-card',
  'update-codemaps',
  'update-docs',
  'vue-review',
]

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Manifest of the skills this script generated. It is the only source of truth
 * for pruning: a skill directory that is not listed here is owned by someone
 * else (a pilot, the vendored `remix` link, the `mastra` bundle, the learned
 * skill farm) and must never be removed by this script.
 */
const MANIFEST_PATH = path.join(DST, '.generated.json')

function parseFrontmatter(raw: string) {
  let m = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return null
  return { fm: m[1]!, body: raw.slice(m[0].length) }
}

function fmField(fm: string, key: string) {
  let m = fm.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.+)$`, 'm'))
  return m ? m[1]!.trim() : undefined
}

/** Escape a literal string for safe use inside a regular expression. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Reduce ECC frontmatter to the keys a harness skill understands, and emit
 * exactly one `name` line. ECC sources carry Claude Code command internals
 * (`command`, `argument-hint`, `disable-model-invocation`, `subtask`) and
 * agent internals (`tools`, `model`, `color`) that are meaningless — and in
 * the `name` case invalid, because a duplicate YAML key is not valid
 * frontmatter — once the file becomes a skill.
 */
function harnessFrontmatter(fm: string, name: string) {
  let kept: string[] = []
  for (let line of fm.split('\n')) {
    let key = line.match(/^([A-Za-z_-]+):/)?.[1]
    if (!key) continue
    if (key === 'name') continue
    if (!HARNESS_FRONTMATTER_KEYS.includes(key)) continue
    kept.push(line)
  }
  return [`name: ${name}`, ...kept].join('\n')
}

function writeSkill(name: string, fm: string, body: string) {
  let dir = path.join(DST, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${fm}\n---\n${body}`)
  return dir
}

let agentsOk = 0
let commandsOk = 0
const problems: string[] = []
const generated = new Set<string>()

// --- agents: every definition becomes a skill ---
const agentsDir = path.join(SRC, 'agents')
for (let file of fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
  let parsed = parseFrontmatter(fs.readFileSync(path.join(agentsDir, file), 'utf8'))
  if (!parsed) {
    problems.push(`agent ${file}: no frontmatter`)
    continue
  }
  let name = fmField(parsed.fm, 'name')
  let description = fmField(parsed.fm, 'description')
  if (!name || !description) {
    problems.push(`agent ${file}: missing name/description`)
    continue
  }
  if (!NAME_RE.test(name)) {
    problems.push(`agent ${file}: invalid name "${name}"`)
    continue
  }
  if (SKIP.has(name)) continue
  let fm = harnessFrontmatter(parsed.fm, name)
  writeSkill(name, fm, parsed.body)
  generated.add(name)
  agentsOk++
}

// --- commands: curated portable set ---
const commandsDir = path.join(SRC, 'commands')
for (let name of INCLUDE_COMMANDS) {
  if (SKIP.has(name)) continue
  if (SKIP_COMMANDS.has(name)) {
    problems.push(`command ${name}: in SKIP_COMMANDS`)
    continue
  }
  let file = path.join(commandsDir, `${name}.md`)
  if (!fs.existsSync(file)) {
    problems.push(`command ${name}: file missing`)
    continue
  }
  let parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!parsed) {
    problems.push(`command ${name}: no frontmatter`)
    continue
  }
  let description = fmField(parsed.fm, 'description')
  if (!description) {
    problems.push(`command ${name}: missing description`)
    continue
  }
  let fm = harnessFrontmatter(parsed.fm, name)
  let body = parsed.body.replace(/\$ARGUMENTS/g, "the user's request")
  writeSkill(name, fm, body)
  generated.add(name)
  commandsOk++
}

// --- prune: drop skills this script generated in an earlier run ---
const previouslyGenerated: string[] = fs.existsSync(MANIFEST_PATH)
  ? (JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).skills ?? [])
  : []

let pruned = 0
for (let name of previouslyGenerated) {
  if (generated.has(name)) continue
  let dir = path.join(DST, name)
  // Only remove a real directory this script owns. A symlink (the vendored
  // `remix` link, the learned skill farm) is never ours to delete.
  if (fs.lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) continue
  if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue
  fs.rmSync(dir, { recursive: true, force: true })
  pruned++
}

fs.writeFileSync(
  MANIFEST_PATH,
  `${JSON.stringify({ skills: [...generated].toSorted() }, null, 2)}\n`,
)

console.log(`agents: ${agentsOk} converted`)
console.log(`commands: ${commandsOk} converted`)
console.log(`pruned: ${pruned} stale generated skill(s)`)
console.log(`skipped pilots: ${[...SKIP].join(', ')}`)
console.log(`skipped infra commands: ${[...SKIP_COMMANDS].toSorted().join(', ')}`)
if (problems.length) {
  console.log('problems:')
  for (let p of problems) console.log(`  - ${p}`)
}

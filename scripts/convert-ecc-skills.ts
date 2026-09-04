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

const HOME = process.env.HOME ?? '/home/lucky'
const SRC = path.join(HOME, 'ECC')
const DST = path.join(process.cwd(), '.agents/skills')

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
  'test-coverage',
  'update-codemaps',
  'update-docs',
  'vue-review',
]

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function parseFrontmatter(raw: string) {
  let m = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return null
  return { fm: m[1]!, body: raw.slice(m[0].length) }
}

function fmField(fm: string, key: string) {
  let m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return m ? m[1]!.trim() : undefined
}

function fmStrip(fm: string, keys: string[]) {
  let re = new RegExp(`^(?:${keys.join('|')}):`, 'm')
  return fm
    .split('\n')
    .filter((l) => !re.test(l))
    .join('\n')
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
  let fm = fmStrip(parsed.fm, ['tools', 'model', 'mode', 'temperature'])
  writeSkill(name, fm, parsed.body)
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
  // The harness requires `name` in frontmatter; command files only carry
  // `description` (+ optional `agent`/`argument-hint`).
  let fm = fmStrip(`name: ${name}\n${parsed.fm}`, ['agent', 'model', 'temperature'])
  let body = parsed.body.replace(/\$ARGUMENTS/g, "the user's request")
  writeSkill(name, fm, body)
  commandsOk++
}

console.log(`agents: ${agentsOk} converted`)
console.log(`commands: ${commandsOk} converted`)
console.log(`skipped pilots: ${[...SKIP].join(', ')}`)
console.log(`skipped infra commands: ${[...SKIP_COMMANDS].sort().join(', ')}`)
if (problems.length) {
  console.log('problems:')
  for (let p of problems) console.log(`  - ${p}`)
}

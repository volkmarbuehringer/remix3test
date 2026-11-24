import { spawn, type ChildProcess } from 'node:child_process'
import * as path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'

const ROOT = path.resolve(import.meta.dirname, '..')
const CLI_ENTRY = path.join(ROOT, 'node_modules', 'remix', 'dist', 'cli-entry.js')
const PROJECTS = ['chromium', 'firefox'] as const
const BASE_ARGS = ['test', '--type', 'e2e', '--concurrency', '2']

const children = new Set<ChildProcess>()

function prefixOutput(stream: NodeJS.ReadableStream | null, project: string): void {
  if (!stream) return
  createInterface({ input: stream }).on('line', (line) => {
    process.stdout.write(`[${project}] ${line}\n`)
  })
}

function runProject(project: (typeof PROJECTS)[number], extraArgs: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    let child = spawn(
      process.execPath,
      [CLI_ENTRY, ...BASE_ARGS, '--project', project, ...extraArgs],
      {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    children.add(child)
    prefixOutput(child.stdout, project)
    prefixOutput(child.stderr, project)
    child.once('error', reject)
    child.once('close', (code, signal) => {
      children.delete(child)
      if (signal) resolve(1)
      else resolve(code ?? 1)
    })
  })
}

process.once('SIGINT', () => {
  for (let child of children) child.kill('SIGINT')
})

const extraArgs = process.argv.slice(2)
const results = await Promise.allSettled(PROJECTS.map((project) => runProject(project, extraArgs)))
let failed = false

for (let [index, result] of results.entries()) {
  let project = PROJECTS[index]!
  if (result.status === 'rejected') {
    failed = true
    console.error(
      `✗ ${project}: ${result.reason instanceof Error ? result.reason.message : result.reason}`,
    )
  } else if (result.value !== 0) {
    failed = true
    console.error(`✗ ${project}: exited with code ${result.value}`)
  } else {
    console.log(`✓ ${project}: passed`)
  }
}

if (failed) process.exitCode = 1

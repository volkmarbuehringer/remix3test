import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as fsPromise from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PLAYWRIGHT_CLI_PATH = fileURLToPath(
  new URL('../node_modules/playwright/cli.js', import.meta.url),
)
const PLAYWRIGHT_WORKING_DIRECTORY = fileURLToPath(new URL('..', import.meta.url))
const PLAYWRIGHT_INSTALL_ARGS = ['install', '--only-shell', 'chromium', 'firefox']
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

async function main() {
  // Always sync vendor skill, regardless of CI or Playwright status
  await syncRemixSkill()

  if (process.env.CI) {
    return
  }

  let installLocations = getPlaywrightInstallLocations()
  if (
    installLocations.length > 0 &&
    installLocations.every((installLocation) => isPlaywrightBrowserInstalled(installLocation))
  ) {
    console.log('Playwright browsers are already installed.')
    return
  }

  try {
    await installPlaywrightBrowsers()
  } catch (error) {
    console.warn(formatPlaywrightInstallError(error))

    if (installLocations.length === 0) {
      installLocations = getPlaywrightInstallLocations()
    }

    cleanPartialPlaywrightInstalls(installLocations)
    console.warn('Retrying Playwright browser installation...')

    try {
      await installPlaywrightBrowsers()
    } catch (retryError) {
      throw new Error(
        [
          formatPlaywrightInstallError(retryError),
          '',
          'Playwright browser installation failed after one retry.',
          'Run `npx playwright install` to retry manually.',
        ].join('\n'),
      )
    }
  }

  // Sync vendor skill from @remix-run/cli
  await syncRemixSkill()
}

async function syncRemixSkill() {
  let pnpmDir = path.join(PROJECT_ROOT, 'node_modules/.pnpm')
  let linkPath = path.join(PROJECT_ROOT, '.opencode/skills/remix')

  try {
    let remixLink = fs.readlinkSync(path.join(PROJECT_ROOT, 'node_modules/remix'))
    let commitMatch = remixLink.match(/tar\.gz\+([a-f0-9]{7,})/)?.[1] || ''
    let commitPrefix = commitMatch.slice(0, 9)

    let entries = await fsPromise.readdir(pnpmDir)
    let cliDir = entries.find((e) => e.startsWith('@remix-run+cli@') && e.includes(commitPrefix))
    if (!cliDir) {
      console.warn('@remix-run/cli not found in pnpm store, skipping skill sync.')
      return
    }

    let sourceDir = path.join(
      pnpmDir,
      cliDir,
      'node_modules/@remix-run/cli/template/.agents/skills/remix',
    )
    if (!fs.existsSync(sourceDir)) {
      console.warn('Vendor skill not found at', sourceDir)
      return
    }

    // Remove existing (file, dir, or broken symlink)
    try {
      let existing = fs.lstatSync(linkPath)
      if (existing.isSymbolicLink() || existing.isDirectory() || existing.isFile()) {
        fs.rmSync(linkPath, { recursive: true, force: true })
      }
    } catch {}

    fs.symlinkSync(sourceDir, linkPath, 'dir')
    console.log('Linked remix vendor skill.')
  } catch (error) {
    console.warn('Failed to sync remix skill:', error)
  }
}

function formatPlaywrightInstallError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

function getPlaywrightInstallLocations(): string[] {
  let result = cp.spawnSync(
    process.execPath,
    [PLAYWRIGHT_CLI_PATH, ...PLAYWRIGHT_INSTALL_ARGS, '--dry-run'],
    {
      cwd: PLAYWRIGHT_WORKING_DIRECTORY,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  )

  if (result.status !== 0) {
    return []
  }

  let installLocations: string[] = []
  let installLocationPattern = /^\s*Install location:\s+(.+)\s*$/gm
  let match: RegExpExecArray | null

  while ((match = installLocationPattern.exec(result.stdout)) != null) {
    let installLocation = match[1]
    if (installLocation !== undefined) {
      installLocations.push(installLocation)
    }
  }

  return installLocations
}

function isPlaywrightBrowserInstalled(installLocation: string): boolean {
  return fs.existsSync(path.join(installLocation, 'INSTALLATION_COMPLETE'))
}

function cleanPartialPlaywrightInstalls(installLocations: string[]) {
  for (let installLocation of installLocations) {
    if (!isPlaywrightBrowserInstalled(installLocation)) {
      fs.rmSync(installLocation, { recursive: true, force: true })
    }
  }
}

function installPlaywrightBrowsers(): Promise<void> {
  return new Promise((resolve, reject) => {
    let child = cp.spawn(process.execPath, [PLAYWRIGHT_CLI_PATH, ...PLAYWRIGHT_INSTALL_ARGS], {
      cwd: PLAYWRIGHT_WORKING_DIRECTORY,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
    })
    let removeSignalHandlers = addSignalHandlers(child)

    let timeout = setTimeout(() => {
      killProcessTree(child)
      reject(new Error(`Timed out after ${INSTALL_TIMEOUT_MS}ms`))
    }, INSTALL_TIMEOUT_MS)

    child.on('error', (error) => {
      clearTimeout(timeout)
      removeSignalHandlers()
      reject(error)
    })

    child.on('exit', (code, signal) => {
      clearTimeout(timeout)
      removeSignalHandlers()

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Exited with ${signal ?? `code ${code ?? 1}`}`))
    })
  })
}

function addSignalHandlers(child: cp.ChildProcess): () => void {
  let signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']
  let handlers = signals.map((signal) => {
    let handler = () => {
      killProcessTree(child)
      process.exit(1)
    }

    process.once(signal, handler)
    return { signal, handler }
  })

  return () => {
    for (let { signal, handler } of handlers) {
      process.removeListener(signal, handler)
    }
  }
}

function killProcessTree(child: cp.ChildProcess) {
  if (child.pid == null) {
    return
  }

  if (process.platform === 'win32') {
    cp.spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {}
}

main().catch((error: unknown) => {
  console.error(formatPlaywrightInstallError(error))
  process.exit(1)
})

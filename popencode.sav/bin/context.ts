#!/usr/bin/env node
/**
 * Context Manager - /context command implementation
 *
 * Operations:
 * - harvest [path]    : Extract knowledge from summaries → permanent context
 * - extract from src  : Extract from docs/code/URLs
 * - organize dir      : Restructure flat files → function-based
 * - map [category]    : View context structure
 * - validate          : Check integrity
 * - migrate           : Copy global → local context
 *
 * Usage: node context.ts [operation] [args]
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createInterface } from 'node:readline'

// Types
interface ContextFile {
  path: string
  size: number
  modified: Date
}

interface HarvestItem {
  id: string
  type: 'concept' | 'example' | 'guide' | 'error' | 'lookup'
  title: string
  preview: string
  targetPath: string
  sourceFile: string
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// Utility functions
function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function divider() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'dim')
}

async function question(prompt: string): Promise<string> {
  let rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Main command router
async function main() {
  let args = process.argv.slice(2)
  let operation = args[0] || 'default'

  switch (operation) {
    case 'default':
    case '':
      await defaultScan()
      break
    case 'harvest':
      await harvest(args[1])
      break
    case 'extract':
      await extract(args.slice(1))
      break
    case 'organize':
      await organize(args[1])
      break
    case 'compact':
      await compact(args[1])
      break
    case 'map':
      await mapContext(args[1])
      break
    case 'validate':
      await validateContext()
      break
    case 'migrate':
      await migrateContext()
      break
    case 'help':
      showHelp()
      break
    default:
      log(`Unknown operation: ${operation}`, 'red')
      showHelp()
      process.exit(1)
  }
}

// Stage 1: Default scan (quick tidy-up)
async function defaultScan() {
  divider()
  log('/context: Quick Scan', 'bright')
  divider()

  let summaries = await findSummaryFiles('.')

  if (summaries.length === 0) {
    log('\n✅ No summary files found. Workspace is clean!', 'green')
    log('\nYour context is already organized.')
    return
  }

  log(`\nFound ${summaries.length} summary file(s):\n`, 'yellow')

  for (let file of summaries) {
    let sizeKB = (file.size / 1024).toFixed(1)
    let modified = file.modified.toLocaleDateString()
    log(`  📄 ${file.path} (${sizeKB} KB, ${modified})`)
  }

  divider()
  log('\nRecommended action:', 'bright')
  log('  /context harvest  - Clean up summaries → permanent context')

  log('\nOther options:', 'dim')
  log('  /context extract from {source}  - Extract from docs/code')
  log('  /context organize {category}    - Restructure existing files')
  log('  /context validate               - Check integrity')
  log('  /context help                   - Show all operations')
}

// Stage 2: Harvest operation
async function harvest(targetPath?: string) {
  divider()
  log('/context harvest', 'bright')
  divider()

  // Stage 1: Scan
  log('\n📋 Stage 1: Scanning for summary files...', 'cyan')
  let files = targetPath ? await findSummaryFiles(targetPath) : await findSummaryFiles('.')

  if (files.length === 0) {
    log('\n✅ No summary files found.', 'green')
    return
  }

  log(`\nFound ${files.length} file(s):`)
  for (let file of files) {
    let sizeKB = (file.size / 1024).toFixed(1)
    log(`  • ${file.path} (${sizeKB} KB)`)
  }

  // Stage 2: Analyze
  log('\n📊 Stage 2: Analyzing content...', 'cyan')
  let items: HarvestItem[] = []
  let id = 'A'.charCodeAt(0)

  for (let file of files) {
    let content = await fs.readFile(file.path, 'utf-8')
    let fileItems = analyzeContent(content, file.path)

    for (let item of fileItems) {
      items.push({
        ...item,
        id: String.fromCharCode(id++),
      })
    }
  }

  if (items.length === 0) {
    log('\n⚠️  No harvestable content found in files.', 'yellow')
    let cleanup = await question('\nDelete these files anyway? [y/n]: ')
    if (cleanup.toLowerCase() === 'y') {
      await cleanupFiles(files, 'delete')
    }
    return
  }

  // Stage 3: Approve
  log('\n✅ Stage 3: Approve extraction', 'cyan')
  divider()

  for (let item of items) {
    let icon =
      item.type === 'error'
        ? '🔴'
        : item.type === 'example'
          ? '💡'
          : item.type === 'guide'
            ? '📖'
            : '💡'
    log(`\n${icon} [${item.id}] ${item.type.toUpperCase()}: ${item.title}`)
    log(`    → ${item.targetPath}`, 'dim')
    log(`    Preview: "${item.preview.substring(0, 60)}..."`, 'dim')
  }

  divider()
  let approved = await question('\nType letters to approve (e.g., "A B C") or "all": ')

  if (approved.toLowerCase() === 'cancel') {
    log('\n❌ Cancelled. No changes made.', 'red')
    return
  }

  let approvedItems: HarvestItem[]
  if (approved.toLowerCase() === 'all') {
    approvedItems = items
  } else {
    let approvedIds = approved.split(/\s+/).map((s) => s.toUpperCase())
    approvedItems = items.filter((item) => approvedIds.includes(item.id))
  }

  if (approvedItems.length === 0) {
    log('\n⚠️  No items approved. Nothing to extract.', 'yellow')
    return
  }

  // Stage 4: Extract
  log('\n📝 Stage 4: Extracting content...', 'cyan')
  let createdFiles: string[] = []

  for (let item of approvedItems) {
    let success = await extractItem(item)
    if (success) {
      createdFiles.push(item.targetPath)
    }
  }

  // Stage 5: Cleanup
  log('\n🗑️  Stage 5: Cleanup source files', 'cyan')
  divider()

  log('\nOptions:')
  log('  1. Archive (safe) - Move to .tmp/archive/harvested/{date}/')
  log('  2. Delete - Permanently remove harvested files')
  log('  3. Keep - Leave source files in place')

  let cleanupChoice = await question('\nChoose [1/2/3] (default: 1): ')
  let method = cleanupChoice === '2' ? 'delete' : cleanupChoice === '3' ? 'keep' : 'archive'

  await cleanupFiles(files, method)

  // Stage 6: Report
  divider()
  log('\n✅ Harvest Complete!', 'green')
  divider()

  log(`\n📊 Extracted ${approvedItems.length} item(s):`)
  for (let file of createdFiles) {
    log(`  ✓ ${file}`)
  }

  log('\n🗑️  Cleanup:')
  if (method === 'archive') {
    log(`  ✓ Archived ${files.length} file(s) to .tmp/archive/harvested/`)
  } else if (method === 'delete') {
    log(`  ✓ Deleted ${files.length} file(s)`)
  } else {
    log(`  ✓ Kept ${files.length} file(s) in place`)
  }

  log('\n💡 Next: Review extracted files and update navigation.md', 'dim')
}

// Find summary files
async function findSummaryFiles(dir: string): Promise<ContextFile[]> {
  let files: ContextFile[] = []
  let patterns = [
    /OVERVIEW\.md$/i,
    /SUMMARY\.md$/i,
    /SESSION-.*\.md$/i,
    /CONTEXT-.*\.md$/i,
    /NOTES\.md$/i,
  ]

  try {
    let entries = await fs.readdir(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory() && entry.name === '.tmp') {
        // Always scan .tmp directory
        let tmpFiles = await findSummaryFiles(fullPath)
        files.push(...tmpFiles)
      } else if (entry.isFile()) {
        let matches = patterns.some((pattern) => pattern.test(entry.name))
        if (matches || (dir === '.' && entry.name.endsWith('.md'))) {
          let stats = await fs.stat(fullPath)
          if (stats.size > 100) {
            // Skip tiny files
            files.push({
              path: fullPath,
              size: stats.size,
              modified: stats.mtime,
            })
          }
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't read
  }

  return files.sort((a, b) => b.modified.getTime() - a.modified.getTime())
}

// Analyze content for harvestable items
function analyzeContent(content: string, sourcePath: string): Omit<HarvestItem, 'id'>[] {
  let items: Omit<HarvestItem, 'id'>[] = []
  let lines = content.split('\n')

  // Simple pattern matching for content types
  let patterns = [
    { type: 'error' as const, regex: /(?:error|issue|problem|fix|bug|exception)/i },
    { type: 'example' as const, regex: /(?:example|code|snippet|```)/i },
    { type: 'guide' as const, regex: /(?:how to|step|guide|setup|install)/i },
    { type: 'concept' as const, regex: /(?:concept|pattern|principle|architecture)/i },
  ]

  // Extract sections (simplified - would be more sophisticated in production)
  let currentSection = ''
  let sectionTitle = ''

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Detect headers
    if (line.startsWith('#')) {
      if (currentSection && sectionTitle) {
        let type = patterns.find((p) => p.regex.test(currentSection))?.type || 'concept'
        let category = detectCategory(sourcePath)

        items.push({
          type,
          title: sectionTitle.replace(/^#+\s*/, ''),
          preview: currentSection.substring(0, 100).replace(/\s+/g, ' '),
          targetPath: `.opencode/context/${category}/${type}s/${slugify(sectionTitle)}.md`,
          sourceFile: sourcePath,
        })
      }

      sectionTitle = line
      currentSection = ''
    } else {
      currentSection += line + '\n'
    }
  }

  // Don't forget last section
  if (currentSection && sectionTitle) {
    let type = patterns.find((p) => p.regex.test(currentSection))?.type || 'concept'
    let category = detectCategory(sourcePath)

    items.push({
      type,
      title: sectionTitle.replace(/^#+\s*/, ''),
      preview: currentSection.substring(0, 100).replace(/\s+/g, ' '),
      targetPath: `.opencode/context/${category}/${type}s/${slugify(sectionTitle)}.md`,
      sourceFile: sourcePath,
    })
  }

  return items
}

// Detect category from path
function detectCategory(filePath: string): string {
  if (filePath.includes('core') || filePath.includes('context-system')) {
    return 'core'
  }
  if (filePath.includes('dev') || filePath.includes('code')) {
    return 'development'
  }
  return 'project-intelligence'
}

// Create slug from title
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/^#+\s*/, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

// Extract item to file
async function extractItem(item: HarvestItem): Promise<boolean> {
  try {
    // Ensure directory exists
    let dir = path.dirname(item.targetPath)
    await fs.mkdir(dir, { recursive: true })

    // Check if file exists
    let existingContent = ''
    try {
      existingContent = await fs.readFile(item.targetPath, 'utf-8')
    } catch {
      // File doesn't exist yet
    }

    // Create MVI-compliant content
    let content = createMVIContent(item)

    if (existingContent) {
      // Append to existing
      await fs.writeFile(item.targetPath, existingContent + '\n\n' + content)
    } else {
      // Create new
      await fs.writeFile(item.targetPath, content)
    }

    return true
  } catch (error) {
    log(`  ✗ Failed to extract ${item.title}: ${error}`, 'red')
    return false
  }
}

// Create MVI-compliant content
function createMVIContent(item: HarvestItem): string {
  let date = new Date().toISOString().split('T')[0]

  return `<!-- Context: ${path.dirname(item.targetPath).replace('.opencode/context/', '').replace(/\//g, '-')} | Priority: medium | Version: 1.0 | Updated: ${date} -->

# ${item.title}

**Purpose**: ${item.preview.substring(0, 80)}...

**Source**: ${item.sourceFile}

## Core Concept

${item.preview.substring(0, 150)}...

## Key Points

- Point 1 (extracted from content)
- Point 2 (extracted from content)
- Point 3 (extracted from content)

## Reference

See ${item.sourceFile} for full context.
`
}

// Cleanup files
async function cleanupFiles(files: ContextFile[], method: 'archive' | 'delete' | 'keep') {
  if (method === 'keep') {
    return
  }

  if (method === 'archive') {
    let date = new Date().toISOString().split('T')[0]
    let archiveDir = `.tmp/archive/harvested/${date}`
    await fs.mkdir(archiveDir, { recursive: true })

    for (let file of files) {
      let basename = path.basename(file.path)
      await fs.rename(file.path, path.join(archiveDir, basename))
    }
  } else if (method === 'delete') {
    for (let file of files) {
      await fs.unlink(file.path)
    }
  }
}

// Helper types and functions for extract operation
interface ParsedSection {
  type: 'concept' | 'example' | 'guide' | 'lookup' | 'error'
  title: string
  content: string
  lineCount: number
}

async function fetchUrl(url: string): Promise<string> {
  try {
    let response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.text()
  } catch (error) {
    throw new Error(`Failed to fetch URL: ${error}`)
  }
}

function parseSections(content: string, sourcePath: string): ParsedSection[] {
  let sections: ParsedSection[] = []
  let lines = content.split('\n')

  let typePatterns = [
    { type: 'error' as const, regex: /(?:error|issue|problem|fix|bug|exception|troubleshoot)/i },
    { type: 'example' as const, regex: /```[a-z]*\n[\s\S]{10,200}```/ },
    { type: 'guide' as const, regex: /(?:how to|step|guide|setup|install|configure)/i },
    { type: 'lookup' as const, regex: /^\|.*\|.*\|/m },
    { type: 'concept' as const, regex: /(?:concept|pattern|principle|architecture|what is)/i },
  ]

  let currentTitle = ''
  let currentContent = ''
  let inCodeBlock = false

  for (let line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
    }

    if (!inCodeBlock && line.startsWith('#')) {
      // Save previous section
      if (currentTitle && currentContent.length > 100) {
        let type = detectSectionType(currentContent, typePatterns)
        sections.push({
          type,
          title: currentTitle.replace(/^#+\s*/, ''),
          content: currentContent.trim(),
          lineCount: currentContent.split('\n').length,
        })
      }
      currentTitle = line
      currentContent = ''
    } else {
      currentContent += line + '\n'
    }
  }

  // Don't forget last section
  if (currentTitle && currentContent.length > 100) {
    let type = detectSectionType(currentContent, typePatterns)
    sections.push({
      type,
      title: currentTitle.replace(/^#+\s*/, ''),
      content: currentContent.trim(),
      lineCount: currentContent.split('\n').length,
    })
  }

  return sections.slice(0, 20) // Limit to 20 sections
}

function detectSectionType(
  content: string,
  patterns: { type: ParsedSection['type']; regex: RegExp }[],
): ParsedSection['type'] {
  for (let pattern of patterns) {
    if (pattern.regex.test(content)) {
      return pattern.type
    }
  }
  return 'concept'
}

function groupByType(sections: ParsedSection[]): Record<string, ParsedSection[]> {
  let groups: Record<string, ParsedSection[]> = {}
  for (let section of sections) {
    if (!groups[section.type]) {
      groups[section.type] = []
    }
    groups[section.type].push(section)
  }
  return groups
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function estimateLines(section: ParsedSection): number {
  // MVI format is compact: frontmatter (8) + title (2) + concept (3) + points (5) + example (10) + ref (2)
  return Math.min(30 + section.content.split('\n').length / 5, 150)
}

function createMVIContentForSection(section: ParsedSection, source: string): string {
  let date = new Date().toISOString().split('T')[0]
  let content = section.content

  // Extract key points (bullet points or numbered lists)
  let keyPoints: string[] = []
  let pointMatches = content.match(/^[\s]*[-*]\s+(.+)$/gm)
  if (pointMatches) {
    for (let match of pointMatches.slice(0, 5)) {
      keyPoints.push(match.replace(/^[\s]*[-*]\s+/, ''))
    }
  }

  // Extract code example
  let codeExample = ''
  let codeMatch = content.match(/```[a-z]*\n([\s\S]{10,500}?)```/)
  if (codeMatch) {
    codeExample = codeMatch[1].trim()
  }

  // Build MVI content
  let mvi = `<!-- Context: extracted | Priority: medium | Version: 1.0 | Updated: ${date} -->

# ${section.title}

**Purpose**: ${content.substring(0, 100).replace(/\n/g, ' ')}...

**Source**: ${source}

## Core Concept

${content.substring(0, 200).replace(/\n/g, ' ')}...
`

  if (keyPoints.length > 0) {
    mvi += '\n## Key Points\n\n'
    for (let point of keyPoints.slice(0, 5)) {
      mvi += `- ${point}\n`
    }
  }

  if (codeExample) {
    mvi += '\n## Example\n\n```\n'
    mvi += codeExample.split('\n').slice(0, 10).join('\n')
    mvi += '\n```\n'
  }

  mvi += '\n## Reference\n\n'
  mvi += `See ${source} for full documentation.\n`

  return mvi
}

async function updateNavigation(category: string, newFiles: string[]) {
  let navPath = `.opencode/context/${category}/navigation.md`

  let content = ''
  try {
    content = await fs.readFile(navPath, 'utf-8')
  } catch {
    // Create new navigation file
    content = `<!-- Context: ${category}/navigation | Priority: high | Version: 1.0 | Updated: ${new Date().toISOString().split('T')[0]} -->

# ${category} Navigation

## Contents

| Type | File | Description |
|------|------|-------------|
`
  }

  // Add new entries
  let date = new Date().toISOString().split('T')[0]
  for (let file of newFiles) {
    let basename = path.basename(file, '.md')
    let type = file.includes('/concepts/')
      ? 'Concept'
      : file.includes('/examples/')
        ? 'Example'
        : file.includes('/guides/')
          ? 'Guide'
          : file.includes('/lookup/')
            ? 'Lookup'
            : file.includes('/errors/')
              ? 'Error'
              : 'Note'

    if (!content.includes(basename)) {
      let line = `| ${type} | ${basename}.md | Extracted on ${date} |\n`
      content = content.replace(/(\|[-]+\|[-]+\|[-]+\|\n)/, `$1${line}`)
    }
  }

  // Update timestamp
  content = content.replace(/Updated: \d{4}-\d{2}-\d{2}/, `Updated: ${date}`)

  await fs.mkdir(path.dirname(navPath), { recursive: true })
  await fs.writeFile(navPath, content)
}

// Extract operation - Extract knowledge from docs/code/URLs
async function extract(args: string[]) {
  divider()
  log('/context extract', 'bright')
  divider()

  if (args.length < 2 || args[0] !== 'from') {
    log('\nUsage: /context extract from {source}', 'yellow')
    log('Examples:', 'dim')
    log('  /context extract from docs/api.md')
    log('  /context extract from src/auth.ts')
    log('  /context extract from https://example.com/docs')
    return
  }

  let source = args[1]
  let isUrl = source.startsWith('http://') || source.startsWith('https://')

  // Stage 1: Read Source
  log('\n📖 Stage 1: Reading source...', 'cyan')
  log(`   Source: ${source}`, 'dim')

  let content: string
  try {
    if (isUrl) {
      content = await fetchUrl(source)
    } else {
      content = await fs.readFile(source, 'utf-8')
    }
    log(`   ✓ Read ${content.split('\n').length} lines`, 'green')
  } catch (error) {
    log(`\n✗ Failed to read source: ${error}`, 'red')
    return
  }

  // Stage 2: Analyze & Categorize
  log('\n📊 Stage 2: Analyzing content...', 'cyan')
  let sections = parseSections(content, source)

  if (sections.length === 0) {
    log('\n⚠️  No extractable sections found.', 'yellow')
    return
  }

  log(`\n   Found ${sections.length} section(s):`)
  let byType = groupByType(sections)
  for (let [type, items] of Object.entries(byType)) {
    log(`     ${type}: ${items.length}`)
  }

  // Stage 3: Select Category (APPROVAL REQUIRED)
  log('\n✅ Stage 3: Select category', 'cyan')
  divider()

  let categories = ['development', 'core', 'project-intelligence']
  log('\nAvailable categories:')
  categories.forEach((cat, i) => log(`  [${i + 1}] ${cat}/`))
  log('  [4] Create new category')

  let catChoice = await question('\nSelect category [1-4]: ')
  let category: string
  if (catChoice === '4') {
    category = await question('Enter new category name: ')
  } else {
    let idx = parseInt(catChoice) - 1
    category = categories[idx] || 'project-intelligence'
  }

  // Stage 4: Preview (APPROVAL REQUIRED)
  log('\n📝 Stage 4: Preview extraction', 'cyan')
  divider()

  log(`\nWill create in ${category}/:\n`)

  let filePlans: { section: ParsedSection; targetPath: string }[] = []
  for (let section of sections) {
    let targetPath = `.opencode/context/${category}/${section.type}s/${slugify(section.title)}.md`
    filePlans.push({ section, targetPath })

    let exists = await fileExists(targetPath)
    let status = exists ? '⚠️  EXISTS' : '✓ NEW'
    log(`  ${status} ${targetPath} (~${estimateLines(section)} lines)`)
  }

  divider()
  let previewChoice = await question("\nPreview content? (type section #, 'all', or 'skip'): ")

  if (previewChoice !== 'skip') {
    let idx = parseInt(previewChoice) - 1
    if (!isNaN(idx) && filePlans[idx]) {
      let plan = filePlans[idx]
      let preview = createMVIContentForSection(plan.section, source)
      log(`\n--- Preview: ${plan.section.title} ---\n`, 'cyan')
      log(preview.substring(0, 500) + '...')
    } else if (previewChoice === 'all') {
      for (let i = 0; i < Math.min(3, filePlans.length); i++) {
        let plan = filePlans[i]
        log(`\n[${i + 1}] ${plan.section.title}:`, 'bright')
        log(plan.section.content.substring(0, 150) + '...', 'dim')
      }
    }
  }

  let approved = await question('\nApprove? [y/n]: ')
  if (approved.toLowerCase() !== 'y') {
    log('\n❌ Cancelled. No files created.', 'red')
    return
  }

  // Stage 5: Create
  log('\n📝 Stage 5: Creating files...', 'cyan')
  let createdFiles: string[] = []

  for (let plan of filePlans) {
    let dir = path.dirname(plan.targetPath)
    await fs.mkdir(dir, { recursive: true })

    let mviContent = createMVIContentForSection(plan.section, source)

    // Check for conflicts
    let finalContent = mviContent
    try {
      let existing = await fs.readFile(plan.targetPath, 'utf-8')
      log(`\n⚠️  ${plan.targetPath} already exists`)
      let action = await question('  [S]kip / [O]verwrite / [M]erge? [s/o/m]: ')
      if (action.toLowerCase() === 's') {
        continue
      } else if (action.toLowerCase() === 'm') {
        finalContent = existing + '\n\n' + mviContent
      }
    } catch {
      // File doesn't exist, proceed
    }

    await fs.writeFile(plan.targetPath, finalContent)
    createdFiles.push(plan.targetPath)
    log(`  ✓ ${plan.targetPath}`, 'green')
  }

  // Stage 6: Update Navigation
  log('\n📊 Stage 6: Updating navigation...', 'cyan')
  await updateNavigation(category, createdFiles)

  // Stage 7: Report
  divider()
  log('\n✅ Extract Complete!', 'green')
  divider()
  log(`\n📄 Created ${createdFiles.length} file(s) in ${category}/`)
  for (let file of createdFiles) {
    log(`  ✓ ${file}`)
  }
  log('\n💡 Review files and update as needed.', 'dim')
}

// Organize operation
async function organize(targetDir?: string) {
  divider()
  log('/context organize', 'bright')
  divider()

  if (!targetDir) {
    log('\nUsage: /context organize {directory}', 'yellow')
    log('Examples:', 'dim')
    log('  /context organize development/')
    return
  }

  log(`\n📁 Organizing: ${targetDir}`, 'cyan')

  // Ensure targetDir exists
  try {
    await fs.access(targetDir)
  } catch {
    log(`\n✗ Directory not found: ${targetDir}`, 'red')
    return
  }

  // Content detection patterns
  let patterns = {
    concepts: /(?:^#.*\n|^what|concept|pattern|architecture|principle)/im,
    examples: /```[a-z]*\n[\s\S]{10,200}```/, // Code blocks
    guides: /(?:^how to|^step|guide|setup|install|workflow)/im,
    lookup: /^\|.*\|.*\|/m, // Markdown tables
    errors: /(?:error|issue|bug|fix|exception|troubleshoot)/i,
  }

  // Find all .md files in the directory
  let mdFiles: string[] = []
  try {
    let entries = await fs.readdir(targetDir, { withFileTypes: true })
    for (let entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        mdFiles.push(entry.name)
      }
    }
  } catch {
    log(`\n✗ Cannot read directory: ${targetDir}`, 'red')
    return
  }

  if (mdFiles.length === 0) {
    log('\n⚠️  No .md files found in directory', 'yellow')
    return
  }

  log(`\nFound ${mdFiles.length} file(s):`, 'cyan')
  for (let file of mdFiles) {
    log(`  • ${file}`)
  }

  // Analyze each file to determine content type
  log('\n📊 Analyzing content...', 'cyan')

  interface FileAnalysis {
    file: string
    type: keyof typeof patterns
    targetDir: string
  }

  let analyses: FileAnalysis[] = []
  let id = 'A'.charCodeAt(0)

  for (let file of mdFiles) {
    let fullPath = path.join(targetDir, file)
    let content: string

    try {
      content = await fs.readFile(fullPath, 'utf-8')
    } catch {
      log(`  ✗ Failed to read ${file}`, 'red')
      continue
    }

    // Determine content type based on patterns
    let detectedType: keyof typeof patterns = 'concepts'
    for (let [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        detectedType = type as keyof typeof patterns
        break
      }
    }

    analyses.push({
      file,
      type: detectedType,
      targetDir: `${detectedType}/`,
    })

    id++
  }

  // Show analysis results
  divider()
  log('\nAnalysis:', 'cyan')

  let fileIdMap = new Map<string, string>()
  let currentId = 'A'.charCodeAt(0)

  for (let analysis of analyses) {
    let fileId = String.fromCharCode(currentId++)
    fileIdMap.set(analysis.file, fileId)
    log(`  [${fileId}] ${analysis.file} → ${analysis.targetDir}`)
  }

  divider()

  // Ask for approval
  let approved = await question('\nApprove reorganization? [y/n]: ')

  if (approved.toLowerCase() !== 'y') {
    log('\n❌ Cancelled. No changes made.', 'red')
    return
  }

  // Execute moves
  log('\n📝 Moving files...', 'cyan')

  let movedFiles: string[] = []
  let conflicts: string[] = []

  for (let analysis of analyses) {
    let sourcePath = path.join(targetDir, analysis.file)
    let funcDir = path.join(targetDir, analysis.targetDir)
    let targetPath = path.join(funcDir, analysis.file)

    try {
      // Create target directory if it doesn't exist
      await fs.mkdir(funcDir, { recursive: true })

      // Check if file already exists in target
      let targetExists = false
      try {
        await fs.access(targetPath)
        targetExists = true
      } catch {
        // File doesn't exist, proceed
      }

      if (targetExists) {
        conflicts.push(analysis.file)
        log(`  ⚠️  Skipped ${analysis.file} - already exists in ${analysis.targetDir}`, 'yellow')
        continue
      }

      // Move the file
      await fs.rename(sourcePath, targetPath)
      movedFiles.push(`${analysis.file} → ${analysis.targetDir}`)
      log(`  ✓ Moved ${analysis.file} → ${analysis.targetDir}`, 'green')
    } catch (error) {
      log(`  ✗ Failed to move ${analysis.file}: ${error}`, 'red')
    }
  }

  // Report results
  divider()
  if (movedFiles.length > 0) {
    log('\n✅ Organization Complete!', 'green')
    log(`\nMoved ${movedFiles.length} file(s):`, 'cyan')
    for (let moved of movedFiles) {
      log(`  ✓ ${moved}`)
    }
  }

  if (conflicts.length > 0) {
    log(`\n⚠️  ${conflicts.length} conflict(s) skipped:`, 'yellow')
    for (let conflict of conflicts) {
      log(`  • ${conflict}`)
    }
  }

  if (movedFiles.length === 0 && conflicts.length === 0) {
    log('\n⚠️  No files were moved', 'yellow')
  }
}

// Map operation
async function mapContext(category?: string) {
  divider()
  log('/context map', 'bright')
  divider()

  let contextDir = '.opencode/context'

  try {
    let entries = await fs.readdir(contextDir, { withFileTypes: true })
    let categories = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    log('\n📊 Context Structure:', 'cyan')

    for (let cat of categories) {
      if (category && cat !== category) continue

      log(`\n📁 ${cat}/`, 'bright')

      let functions = ['concepts', 'examples', 'guides', 'lookup', 'errors']
      for (let func of functions) {
        let funcDir = path.join(contextDir, cat, func)
        try {
          let files = await fs.readdir(funcDir)
          let mdFiles = files.filter((f) => f.endsWith('.md'))
          if (mdFiles.length > 0) {
            log(`  ${func}/: ${mdFiles.length} file(s)`)
            for (let file of mdFiles.slice(0, 3)) {
              log(`    • ${file}`, 'dim')
            }
            if (mdFiles.length > 3) {
              log(`    ... and ${mdFiles.length - 3} more`, 'dim')
            }
          }
        } catch {
          // Directory doesn't exist
        }
      }
    }
  } catch (error) {
    log('\n⚠️  No context directory found at .opencode/context/', 'yellow')
    log('Run /context harvest to create context files.', 'dim')
  }
}

// Validate operation
async function validateContext() {
  divider()
  log('/context validate', 'bright')
  divider()

  log('\n🔍 Validating context files...', 'cyan')

  let issues: string[] = []
  let contextDir = '.opencode/context'

  try {
    await validateDirectory(contextDir, issues)
  } catch {
    issues.push('No .opencode/context directory found')
  }

  if (issues.length === 0) {
    log('\n✅ All context files are valid!', 'green')
  } else {
    log(`\n⚠️  Found ${issues.length} issue(s):`, 'yellow')
    for (let issue of issues) {
      log(`  • ${issue}`)
    }
  }
}

// Recursive validation
async function validateDirectory(dir: string, issues: string[]) {
  let entries = await fs.readdir(dir, { withFileTypes: true })

  for (let entry of entries) {
    let fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await validateDirectory(fullPath, issues)
    } else if (entry.name.endsWith('.md')) {
      let content = await fs.readFile(fullPath, 'utf-8')
      let lines = content.split('\n')

      // Check file size
      if (lines.length > 200) {
        issues.push(`${fullPath}: ${lines.length} lines (max 200)`)
      }

      // Check frontmatter
      if (!content.includes('<!-- Context:')) {
        issues.push(`${fullPath}: Missing HTML frontmatter`)
      }
    }
  }
}

// Migrate operation
async function migrateContext() {
  divider()
  log('/context migrate', 'bright')
  divider()

  let globalDir = `${process.env.HOME}/.config/opencode/context/project-intelligence`
  let localDir = '.opencode/context/project-intelligence'

  log(`\n🔄 Migrating global → local context`, 'cyan')
  log(`\nFrom: ${globalDir}`, 'dim')
  log(`To: ${localDir}`, 'dim')

  // Check if global directory exists
  let globalFiles: string[] = []
  try {
    let entries = await fs.readdir(globalDir, { withFileTypes: true, recursive: true })
    globalFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => path.relative(globalDir, path.join(e.parentPath || globalDir, e.name)))
  } catch {
    log('\n✗ Global context directory not found', 'red')
    log('   No migration needed - no global context exists.', 'dim')
    return
  }

  if (globalFiles.length === 0) {
    log('\n✗ No files found in global context', 'yellow')
    return
  }

  // Show found files with sizes
  log(`\nFound ${globalFiles.length} file(s) in global context:`, 'cyan')

  interface FileInfo {
    relativePath: string
    size: number
    globalPath: string
    localPath: string
    existsLocally: boolean
  }

  let fileInfos: FileInfo[] = []

  for (let relativePath of globalFiles) {
    let globalPath = path.join(globalDir, relativePath)
    let localPath = path.join(localDir, relativePath)

    try {
      let stats = await fs.stat(globalPath)
      let existsLocally = false
      try {
        await fs.access(localPath)
        existsLocally = true
      } catch {
        // File doesn't exist locally
      }

      fileInfos.push({
        relativePath,
        size: stats.size,
        globalPath,
        localPath,
        existsLocally,
      })

      let sizeKB = (stats.size / 1024).toFixed(1)
      let conflictMarker = existsLocally ? ' ⚠️ ' : ''
      log(`  • ${relativePath} (${sizeKB} KB)${conflictMarker}`)
    } catch {
      log(`  ✗ Failed to stat ${relativePath}`, 'red')
    }
  }

  // Check for conflicts
  let conflicts = fileInfos.filter((f) => f.existsLocally)
  if (conflicts.length > 0) {
    log(`\n⚠️  ${conflicts.length} file(s) already exist locally:`, 'yellow')
    for (let conflict of conflicts) {
      let localStats = await fs.stat(conflict.localPath).catch(() => ({ size: 0 }))
      log(`  • ${conflict.relativePath}`)
      log(`    Global: ${(conflict.size / 1024).toFixed(1)} KB`, 'dim')
      log(`    Local:  ${(localStats.size / 1024).toFixed(1)} KB`, 'dim')
    }

    divider()
    log('\nOptions:', 'cyan')
    log('  1. Overwrite local with global')
    log('  2. Keep local, skip conflicting files')
    log('  3. Archive local, then copy global')

    let choice = await question('\nChoose [1/2/3] (default: 2): ')
    let strategy = choice === '1' ? 'overwrite' : choice === '3' ? 'archive' : 'skip'

    if (strategy === 'skip') {
      log('\nℹ️  Will skip conflicting files and copy only new files.', 'dim')
    } else if (strategy === 'archive') {
      log('\nℹ️  Will archive local files before copying global.', 'dim')
    } else {
      log('\n⚠️  Will overwrite local files with global versions.', 'yellow')
    }

    // Process files based on strategy
    log('\n📝 Processing files...', 'cyan')

    let copiedFiles: string[] = []
    let skippedFiles: string[] = []
    let archivedFiles: string[] = []

    for (let fileInfo of fileInfos) {
      // Ensure target directory exists
      let targetDir = path.dirname(fileInfo.localPath)
      await fs.mkdir(targetDir, { recursive: true })

      if (fileInfo.existsLocally) {
        if (strategy === 'skip') {
          skippedFiles.push(fileInfo.relativePath)
          log(`  ⏭  Skipped ${fileInfo.relativePath}`, 'dim')
          continue
        } else if (strategy === 'archive') {
          // Archive the local file first
          let archiveDir = path.join(
            `${process.env.HOME}/.config/opencode/context/project-intelligence.bak`,
            path.dirname(fileInfo.relativePath),
          )
          await fs.mkdir(archiveDir, { recursive: true })
          let archivePath = path.join(
            archiveDir,
            `${path.basename(fileInfo.relativePath, '.md')}.bak.md`,
          )
          await fs.copyFile(fileInfo.localPath, archivePath)
          archivedFiles.push(fileInfo.relativePath)
        }
      }

      // Copy the file
      try {
        await fs.copyFile(fileInfo.globalPath, fileInfo.localPath)
        copiedFiles.push(fileInfo.relativePath)
        let action = fileInfo.existsLocally && strategy === 'overwrite' ? 'Overwritten' : 'Copied'
        log(`  ✓ ${action} ${fileInfo.relativePath}`, 'green')
      } catch (error) {
        log(`  ✗ Failed to copy ${fileInfo.relativePath}: ${error}`, 'red')
      }
    }

    // Report results
    divider()
    log('\n✅ Migration Complete!', 'green')

    if (copiedFiles.length > 0) {
      log(`\n📄 Copied ${copiedFiles.length} file(s):`, 'cyan')
      for (let file of copiedFiles) {
        log(`  ✓ ${file}`)
      }
    }

    if (archivedFiles.length > 0) {
      log(
        `\n📦 Archived ${archivedFiles.length} file(s) to ~/.config/opencode/context/project-intelligence.bak/`,
        'cyan',
      )
    }

    if (skippedFiles.length > 0) {
      log(`\n⏭  Skipped ${skippedFiles.length} file(s) (kept local):`, 'dim')
      for (let file of skippedFiles) {
        log(`  • ${file}`)
      }
    }
  } else {
    // No conflicts - simple copy
    log('\n✅ No conflicts found - all files are new', 'green')
    let proceed = await question('\nProceed with migration? [y/n]: ')

    if (proceed.toLowerCase() !== 'y') {
      log('\n❌ Cancelled. No changes made.', 'red')
      return
    }

    log('\n📝 Copying files...', 'cyan')

    let copiedFiles: string[] = []

    for (let fileInfo of fileInfos) {
      try {
        // Ensure target directory exists
        let targetDir = path.dirname(fileInfo.localPath)
        await fs.mkdir(targetDir, { recursive: true })

        // Copy the file
        await fs.copyFile(fileInfo.globalPath, fileInfo.localPath)
        copiedFiles.push(fileInfo.relativePath)
        log(`  ✓ Copied ${fileInfo.relativePath}`, 'green')
      } catch (error) {
        log(`  ✗ Failed to copy ${fileInfo.relativePath}: ${error}`, 'red')
      }
    }

    // Report results
    divider()
    log('\n✅ Migration Complete!', 'green')
    log(`\n📄 Copied ${copiedFiles.length} file(s):`, 'cyan')
    for (let file of copiedFiles) {
      log(`  ✓ ${file}`)
    }
  }

  // Ask about global cleanup
  divider()
  let cleanupChoice = await question('\nKeep global files after migration? [y/n] (default: y): ')
  let keepGlobal = cleanupChoice.toLowerCase() !== 'n'

  if (keepGlobal) {
    log('\nℹ️  Global files kept at:', 'dim')
    log(`   ${globalDir}`, 'dim')
  } else {
    // Create backup before deleting
    let backupDir = `${globalDir}.bak`
    try {
      await fs.mkdir(backupDir, { recursive: true })
      for (let fileInfo of fileInfos) {
        let backupPath = path.join(backupDir, fileInfo.relativePath)
        let backupParent = path.dirname(backupPath)
        await fs.mkdir(backupParent, { recursive: true })
        await fs.copyFile(fileInfo.globalPath, backupPath)
      }
      log('\n📦 Global files backed up to:', 'cyan')
      log(`   ${backupDir}`, 'dim')
    } catch {
      log('\n⚠️  Failed to create backup', 'yellow')
    }
  }

  log('\n💡 Your context is now available locally in .opencode/context/', 'dim')
}

// Compact operation - minimize file to MVI format
async function compact(filePath?: string) {
  divider()
  log('/context compact', 'bright')
  divider()

  if (!filePath) {
    log('\nUsage: /context compact {file}', 'yellow')
    log('Examples:', 'dim')
    log('  /context compact development/concepts/auth.md')
    log('  /context compact .opencode/context/core/workflows.md')
    return
  }

  // Check file exists
  try {
    await fs.access(filePath)
  } catch {
    log(`\n✗ File not found: ${filePath}`, 'red')
    return
  }

  // Read file
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    log(`\n✗ Failed to read file: ${error}`, 'red')
    return
  }

  let originalLines = content.split('\n').length
  let originalSizeKB = (content.length / 1024).toFixed(1)

  log(`\n📄 File: ${filePath}`, 'cyan')
  log(`   Original: ${originalLines} lines, ${originalSizeKB} KB`, 'dim')

  if (originalLines <= 200) {
    log('\n✅ File is already MVI compliant (<200 lines)', 'green')
    return
  }

  // Analyze and compact
  log('\n🔍 Analyzing content...', 'cyan')

  let compacted = await compactContent(content, filePath)
  let newLines = compacted.split('\n').length
  let newSizeKB = (compacted.length / 1024).toFixed(1)
  let reduction = (((originalLines - newLines) / originalLines) * 100).toFixed(0)

  // Show preview
  divider()
  log('\n📋 Compacted Preview:', 'bright')
  divider()

  let previewLines = compacted.split('\n').slice(0, 30)
  log('\n' + previewLines.join('\n'))

  if (newLines > 30) {
    log(`\n... (${newLines - 30} more lines)`, 'dim')
  }

  divider()
  log(`\n📊 Summary:`, 'cyan')
  log(`   Before: ${originalLines} lines, ${originalSizeKB} KB`)
  log(`   After:  ${newLines} lines, ${newSizeKB} KB`)
  log(`   Reduction: ${reduction}%`, 'green')

  // Approval
  let approved = await question('\nReplace original with compacted version? [y/n]: ')

  if (approved.toLowerCase() !== 'y') {
    log('\n❌ Cancelled. No changes made.', 'red')
    return
  }

  // Backup original
  let backupPath = `${filePath}.bak`
  try {
    await fs.copyFile(filePath, backupPath)
    log(`\n📦 Original backed up to: ${backupPath}`, 'dim')
  } catch {
    log('\n⚠️  Failed to create backup', 'yellow')
    let proceed = await question('Proceed anyway? [y/n]: ')
    if (proceed.toLowerCase() !== 'y') {
      return
    }
  }

  // Write compacted version
  try {
    await fs.writeFile(filePath, compacted)
    log('\n✅ File compacted successfully!', 'green')
  } catch (error) {
    log(`\n✗ Failed to write file: ${error}`, 'red')
    return
  }
}

// Compact content using MVI principles
async function compactContent(content: string, filePath: string): Promise<string> {
  let lines = content.split('\n')
  let fileName = path.basename(filePath, '.md')

  // Extract title
  let title = fileName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  for (let line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace('# ', '')
      break
    }
  }

  // Extract core concept (first paragraph after title)
  let coreConcept = ''
  let inCoreSection = false
  for (let line of lines) {
    if (line.startsWith('# ')) {
      inCoreSection = true
      continue
    }
    if (inCoreSection && line.trim() && !line.startsWith('#')) {
      coreConcept = line.trim()
      break
    }
  }

  // Extract key points (bullet points)
  let keyPoints: string[] = []
  for (let line of lines) {
    if (line.match(/^\s*[-*]\s+/) && !line.includes('TODO') && !line.includes('FIXME')) {
      let point = line.replace(/^\s*[-*]\s+/, '').trim()
      if (point && point.length > 10 && point.length < 150) {
        keyPoints.push(point)
        if (keyPoints.length >= 5) break
      }
    }
  }

  // Extract minimal example (code block)
  let example = ''
  let inCodeBlock = false
  let codeContent: string[] = []
  for (let line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        if (codeContent.length >= 3 && codeContent.length <= 10) {
          example = codeContent.join('\n')
          break
        }
        codeContent = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
    } else if (inCodeBlock) {
      codeContent.push(line)
    }
  }

  // Extract reference links
  let references: string[] = []
  for (let line of lines) {
    if (line.match(/https?:\/\//)) {
      let match = line.match(/https?:\/\/[^\s)]+/)
      if (match) {
        references.push(match[0])
        if (references.length >= 2) break
      }
    }
  }

  // Determine category from path
  let pathParts = filePath.split('/')
  let categoryIndex = pathParts.indexOf('context')
  let category =
    categoryIndex >= 0 && pathParts[categoryIndex + 1] ? pathParts[categoryIndex + 1] : 'general'

  // Determine function type from path
  let functionType =
    pathParts.find((p) => ['concepts', 'examples', 'guides', 'lookup', 'errors'].includes(p)) ||
    'concepts'

  // Build compacted content
  let date = new Date().toISOString().split('T')[0]
  let priority = functionType === 'errors' ? 'high' : 'medium'

  let compacted = `<!-- Context: ${category}/${functionType} | Priority: ${priority} | Version: 1.0 | Updated: ${date} -->

# ${title}

**Purpose**: ${coreConcept || 'Core ' + functionType.slice(0, -1) + ' for ' + category}

**Last Updated**: ${date}

---

## Core Concept

${coreConcept || 'Brief description of the concept.'}

## Key Points

${
  keyPoints.length > 0
    ? keyPoints.map((p) => `- ${p}`).join('\n')
    : `- Key point 1 (extracted from original)\n- Key point 2 (extracted from original)\n- Key point 3 (extracted from original)`
}

${
  example
    ? `## Quick Example

\`\`\`typescript
${example}
\`\`\`
`
    : ''
}
${
  references.length > 0
    ? `
## References

${references.map((r) => `- ${r}`).join('\n')}
`
    : ''
}
## Related Files

- Original: ${filePath}
- Backup: ${filePath}.bak
`

  return compacted.trim()
}

// Help
function showHelp() {
  divider()
  log('/context - Context Manager', 'bright')
  divider()

  log('\n📋 Operations:', 'cyan')

  log('\n  /context                    - Quick scan workspace')
  log('  /context harvest [path]     - Extract from summaries')
  log('  /context extract from src   - Extract from docs/code')
  log('  /context organize dir       - Restructure files')
  log('  /context compact file       - Minimize to MVI format')
  log('  /context map [category]     - View structure')
  log('  /context validate           - Check integrity')
  log('  /context migrate            - Global → local')
  log('  /context help               - Show this help')

  log('\n💡 Examples:', 'cyan')
  log('  /context harvest')
  log('  /context harvest .tmp/')
  log('  /context compact development/concepts/auth.md')
  log('  /context map development')
  log('  /context validate')

  log('\n📚 Standards:', 'dim')
  log('  • MVI: <200 lines, scannable in <30s')
  log('  • Structure: concepts/, examples/, guides/, lookup/, errors/')
  log('  • Frontmatter: <!-- Context: category | Priority: level | Version: X.Y -->')
}

// Run
main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

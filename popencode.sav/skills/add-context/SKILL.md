# /add-context Command

Interactive wizard for creating Project Intelligence context files following MVI compliance standards.

## Usage

```bash
/add-context                 # Interactive wizard (recommended)
/add-context --update        # Update existing context
/add-context --tech-stack    # Add/update tech stack only
/add-context --patterns      # Add/update code patterns only
/add-context --global        # Save to global config
```

## Implementation

The wizard is implemented as a TypeScript script that runs interactively in the terminal.

### Location

`.opencode/bin/add-context.ts` - Executable TypeScript script

### Key Features

1. **Stage 0**: Detect external context files in `.tmp/`
2. **Stage 1**: Detect existing project intelligence
3. **Stage 1.5**: Review existing patterns (if updating)
4. **Stage 2**: Interactive 6-question wizard
5. **Stage 3**: Generate/update technical-domain.md
6. **Stage 4**: Validation
7. **Stage 5**: Confirmation & next steps

### Files Created

- `$CONTEXT_DIR/technical-domain.md` - Tech stack and patterns
- `$CONTEXT_DIR/navigation.md` - Quick reference

### MVI Compliance

All generated files follow MVI standards:

- <200 lines
- HTML frontmatter with metadata
- Codebase references section
- 30-second scannable format

## Dependencies

- Node.js 18+
- TypeScript (tsx for execution)
- chalk (terminal colors)
- inquirer (interactive prompts)

## Example

```bash
$ /add-context

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/add-context: Project Intelligence Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q 1/6: What's your tech stack?
Examples:
  1. Next.js + TypeScript + PostgreSQL + Tailwind
  2. React + Python + MongoDB + Material-UI
  3. Vue + Go + MySQL + Bootstrap
  4. Other (describe)

Your tech stack: Next.js 14 + TypeScript + Prisma + Tailwind
...
```

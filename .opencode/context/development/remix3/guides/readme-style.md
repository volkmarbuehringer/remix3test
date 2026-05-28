<!-- Context: development/remix3/guides/readme-style | Priority: medium | Version: 1.0 | Updated: 2026-03-24 -->

# README Conventions

How to write package README files in Remix repository style.

## Core Concept

READMEs should be concise package documentation for real users - not marketing copy or API dumps. Mirror existing package structure, keep examples production-oriented.

## Section Order

1. `# <package-name>` - Short intro (1-2 sentences)
2. `## Features` - Flat bullet list of highlights
3. `## Installation`
4. `## Usage` - Realistic production example
5. `## [Feature sections]` - One per major capability
6. `## Related Packages`
7. `## Related Work`
8. `## License`

## Installation Rules

Always start with:

```sh
npm i remix
```

If peer dependencies required:

```sh
npm i remix <peer-dependency>
```

## Usage Rules

- Import from `remix/...`, never `@remix-run/...`
- First example should show realistic production code
- Feature sections show major capabilities with examples
- Keep prose compact, avoid awkward line breaks

## Example Structure

````md
# fetch-router

A lightweight router built on Web Standards...

## Features

- Route matching with pattern support
- Middleware composition
- Type-safe request handling

## Installation

npm i remix

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
// ... realistic example
```
````

## Related Packages

- `remix/dev` - Development tools

```

## Checklist

- [ ] Intro explains package in 1-2 sentences
- [ ] Features list surfaces main value
- [ ] Installation uses `npm i remix`
- [ ] Main example shows production scenario
- [ ] Each major feature has an example
- [ ] Ends with Related Packages, Related Work, License

## 📂 Codebase References

- `packages/fetch-router/README.md` - Reference example
- `.agents/skills/write-readme/SKILL.md` - Full skill guide

## Related

- `guides/monorepo-packages.md` - Package structure
- `guides/api-documentation.md` - API docs patterns
```

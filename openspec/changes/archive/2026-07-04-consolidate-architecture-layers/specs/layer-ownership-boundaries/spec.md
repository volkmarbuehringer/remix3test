# Layer Ownership Boundaries

## Purpose

Enforce a disk layout where `app/ui/` imports types only from `app/data/` (or `app/types/`), the directory `app/lib/` does not exist, and `app/assets.ts`'s allow list excludes `app/lib/**`.

## ADDED Requirements

### Requirement: UI does not import from controllers
Files under `app/ui/**` SHALL NOT import any value or type from `app/actions/**` controller files. Shape types used by UI SHALL be imported from `app/data/**` or `app/types/**`.

#### Scenario: UI imports offering row type
- **WHEN** a maintainer greps `app/ui/**` for imports matching `from '.*actions/.*controller'`
- **THEN** zero matches are returned

#### Scenario: Offering row type lives in data
- **WHEN** a maintainer needs the `OfferingRow` type
- **THEN** it is exported from `app/data/offerings-queries.ts`
- **AND** `app/actions/verwaltung/offerings/controller.tsx` imports it from there rather than declaring it inline

### Requirement: `app/lib/` does not exist
No file or directory SHALL exist at `app/lib/` after this change. Every former `app/lib/*` resident SHALL have a new home in `app/ui/theme/`, `app/data/`, or `app/utils/`.

#### Scenario: No lib directory on disk
- **WHEN** a maintainer lists `app/` looking for `lib`
- **THEN** no `app/lib/` directory exists

#### Scenario: Theme primitives live under ui/theme
- **WHEN** a maintainer needs `theme.ts`, `button.ts`, `glyph.ts`, or `separator.ts`
- **THEN** they are located under `app/ui/theme/**`

#### Scenario: Pure utilities live under utils
- **WHEN** a maintainer needs `request-ip.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, or `messages-sse.ts`
- **THEN** they are located under `app/utils/**`

### Requirement: Asset allow list excludes `app/lib/**`
`app/assets.ts` SHALL NOT list `app/lib/**` in its bundler allow list.

#### Scenario: Allow list trimmed
- **WHEN** a maintainer reads `app/assets.ts:12` (the `allow` array)
- **THEN** the array contains `app/assets/**`, `app/routes.ts`, `app/ui/**`, `app/utils/**`, and `node_modules/**`
- **AND** does not contain `app/lib/**`

#### Scenario: Pipeline still bundles relocated files
- **WHEN** the asset pipeline runs against a build that includes relocated files under `app/ui/theme/**` and `app/utils/**`
- **THEN** those files bundle successfully because `app/ui/**` and `app/utils/**` remain allow-listed

### Requirement: Shape types co-locate with their owner
A shape type returned by a repository SHALL be exported from that repository's module. A shape type with no repository owner SHALL be exported from `app/types/<domain>.ts`.

#### Scenario: Types exported next to their SQL
- **WHEN** a maintainer edits the offering SELECT in `app/data/offerings-queries.ts`
- **THEN** the `OfferingRow` and `OfferingsResourceOption` types are exported from the same file
- **AND** no other module re-defines them

#### Scenario: Cross-cutting DTO has no repository owner
- **WHEN** a shape type is consumed by both `app/middleware/**` and `app/ui/**` but is not produced by any repository
- **THEN** it lives in `app/types/<domain>.ts`
- **AND** no `app/types/index.ts` barrel re-export exists
## ADDED Requirements

### Requirement: Button imports use remix/ui/button

All imports from `remix/components/button` SHALL be updated to `remix/ui/button`. The `Button` export is identical — only the path changes.

#### Scenario: All button imports are migrated

- **WHEN** searching for `remix/components/button` across `app/`
- **THEN** zero matches remain

#### Scenario: TypeScript compilation passes

- **WHEN** running `tsc --noEmit`
- **THEN** no module-resolution errors for `remix/ui/button`

### Requirement: Breadcrumbs imports use remix/ui/breadcrumbs

All imports from `remix/components/breadcrumbs` SHALL be updated to `remix/ui/breadcrumbs`. The `Breadcrumbs` and `BreadcrumbItem` exports are identical.

#### Scenario: All breadcrumbs imports are migrated

- **WHEN** searching for `remix/components/breadcrumbs` across `app/`
- **THEN** zero matches remain

### Requirement: Menu styled imports use remix/ui/menu

All imports of `MenuItem`, `MenuList`, `Submenu` from `remix/components/menu` SHALL be updated to `remix/ui/menu`. Primitive imports (`* as menu`, `onMenuSelect`) already use `remix/ui/menu` and SHALL remain unchanged.

#### Scenario: All menu styled imports are migrated

- **WHEN** searching for `remix/components/menu` across `app/`
- **THEN** zero matches remain

#### Scenario: Menu primitives imports are unchanged

- **WHEN** searching for `remix/ui/menu` across `app/`
- **THEN** the existing primitive imports remain and resolve correctly

### Requirement: No broken imports remain

The app SHALL have zero module-resolution errors after the migration.

#### Scenario: Full import audit

- **WHEN** running `tsc --noEmit`
- **THEN** no `Cannot find module` errors for any `remix/ui/*` or `remix/components/*` path

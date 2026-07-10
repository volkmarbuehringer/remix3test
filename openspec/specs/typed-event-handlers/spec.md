# typed-event-handlers Specification

## Purpose

TBD - created by archiving change type-event-handlers-and-error-logging. Update Purpose after archive.

## Requirements

### Requirement: Event handlers use specific DOM event types

The system SHALL type Remix 3 `on()` mixin callbacks with the correct DOM event type instead of `any`.

#### Scenario: Keyboard event handlers use KeyboardEvent type

- **WHEN** an `on('keydown', ...)` callback is defined in `appointment-grid.tsx` or `appointtype-panel.tsx`
- **THEN** the callback parameter SHALL be typed as `KeyboardEvent` instead of `any`

#### Scenario: Pointer event handlers use PointerEvent type

- **WHEN** an `on('pointerdown', ...)` callback is defined in `appointment-grid.tsx`
- **THEN** the callback parameter SHALL be typed as `PointerEvent` instead of `any`

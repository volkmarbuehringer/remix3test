## Context

The admin CRUD for appointments at `/admin/appointments` uses raw SQL via `pool.query()` and renders time dropdowns with 24 hourly options. The `/appointment` calendar (public-facing, at `/appointment`) creates appointments with 15-minute granularity — the draft defaults to a 15-min block and resize snaps to 15-min boundaries.

The `during` column is `int4range` with `start_min` and `end_min` as `INTEGER GENERATED ALWAYS AS (lower/upper(during)) STORED` computed columns — they natively store any integer minute value. Only the admin form's dropdown restricts to hourly values.

## Goals / Non-Goals

**Goals:**
- Make the admin edit and create forms support any minute value (15-min granularity), matching what `/appointment` can produce
- Update server-side validation to accept 15-min increments
- Keep the grid display working (it already handles any granularity via `formatDuring()`)

**Non-Goals:**
- No database schema changes (computed columns already store any integer)
- No changes to `/appointment` calendar UI or creation logic
- No changes to the public appointment controller (`appointment-controller.tsx`)
- No changes to the `during` range format or int4range handling

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Granularity to support | **15 minutes** (96 options) | Matches `/appointment`'s snap-to-15-min behavior. 5-min would add 3× more options with no benefit. 1-min adds 1440 options — unusable as a dropdown |
| Shared vs separate constants | **Separate per file** | The edit and create pages each define their own `START_MIN_OPTIONS` / `END_MIN_OPTIONS`. Extracting to a shared util is unnecessary for two files and adds indirection. Simple array literals can be updated inline |
| Validation change | **`% 15 === 0`** replacing `% 60 === 0` | Matches the new dropdown options. The min/max bounds (0–1380 for start, 15–1440 for end) remain the same. The "end > start" check remains unchanged |
| Time format display | **`HH:MM` formatting already works** | `formatMinOption()` divides by 60 and pads — e.g., `45 → "00:45"`, `495 → "08:15"`. No changes needed |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **Dropdown too long**: 96 options in a `<select>` is more scrolling than 24 | 96 options is standard for minute-pickers. The option text is short ("08:00", "08:15") so the list stays compact. Native `<select>` handles scrolling natively |
| **Existing hourly-only appointments**: If `start_min` or `end_min` is already a multiple of 60, the corresponding option still matches — no regression | All existing hourly values (e.g., 480, 540) are also multiples of 15, so they'll match a 15-min option |
| **Create form default end time**: Currently defaults to 17:00 (1020). With 15-min options, 1020 still exists. Default unaffected | Verify `end_min` default in create form still matches |

## Open Questions

*(None — scope is well understood.)*

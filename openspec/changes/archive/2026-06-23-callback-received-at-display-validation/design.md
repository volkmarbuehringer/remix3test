## Context

The webhook requests table stores `callback_received_at` (BIGINT epoch ms) and `callback_response` (JSONB) columns, populated by the external callback endpoint (`POST /callback`). Currently:
- The webhook requests grid does not display `callback_received_at`
- The callback endpoint unconditionally overwrites both columns on every request

## Goals / Non-Goals

**Goals:**
- Display `callback_received_at` as a readable timestamp column in the webhook requests grid, sortable like other columns
- Reject duplicate callbacks at the endpoint before modifying data

**Non-Goals:**
- No changes to the callback response display (already shown)
- No changes to the callback authentication or IP validation

## Decisions

1. **SELECT-then-UPDATE vs WHERE check**: Use a SQL `WHERE callback_received_at IS NULL` clause in the UPDATE. This avoids a separate SELECT round-trip and is atomic. If `rowCount === 0`, the row either doesn't exist or already has a callback — return 409 Conflict.

2. **No separate `callback_received_at` sort scope**: `callback_received_at` will be added to `ORDER_BY_COLUMNS` in the webhook-requests controller, following the same pattern as other columns.

3. **Display format**: Use the existing `fmtDate()` helper (locale `de-DE`) to format the epoch timestamp, consistent with `created_at`.

## Risks / Trade-offs

- The WHERE callback_received_at IS NULL approach cannot distinguish between "row not found" and "callback already received" (both return 0 rows). A 409 response is clearer to the caller in both cases. A 404 should still be used only when the id genuinely doesn't exist — but since both cases produce the same HTTP response, this is an acceptable trade-off.
- Adding a column to the grid increases horizontal scrolling on narrow screens. The table already has 6 columns; this adds a 7th. Acceptable for an admin tool.

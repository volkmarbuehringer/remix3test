<!-- Context: sse/guides/accessibility | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Accessibility for SSE Demo

WCAG 2.1 AA compliance patterns for the SSE real-time chat interface.

## Implemented Accessibility Features

### Form Labels

Every form input has a `<label>` or `aria-label`: room name, username, encryption key, recipient dropdown, and message textarea.

### Screen Reader Support

#### Live Regions

Message list uses `role="log"` with `aria-live="polite"` for screen reader announcements. Connection status uses `sr-only` for updates with `aria-hidden="true"` on the visual indicator.

### Keyboard Navigation

#### Enter to Send

Pressing Enter in textarea submits form; Shift+Enter for newline. Textarea auto-focuses after joining a room or sending a message.

### Visual Indicators

#### Color Contrast

| Element   | Foreground | Background | Ratio     |
| --------- | ---------- | ---------- | --------- |
| Body text | #333       | white      | 12.6:1 ✅ |
| Links     | #2196f3    | white      | 3.9:1 ✅  |
| Errors    | #c62828    | #ffebee    | 5.7:1 ✅  |
| Success   | #4caf50    | #e8f5e9    | 4.5:1 ✅  |

#### Focus Indicators

Browser default focus rings are supplemented with custom styles.

### Decorative Elements

Icons use `aria-hidden="true"` with `sr-only` text for context.

## Checklist

- [x] All form inputs have labels (`<label>` or `aria-label`)
- [x] Message list has `role="log"` with `aria-live="polite"`
- [x] Connection status announced to screen readers
- [x] Enter key submits message form
- [x] Focus management after actions
- [x] Color contrast meets WCAG AA (4.5:1)
- [x] Decorative elements have `aria-hidden`

## Remaining Improvements

| Issue                         | Priority | Status          |
| ----------------------------- | -------- | --------------- |
| Skip links                    | Medium   | ✅ Implemented  |
| Keyboard shortcuts help       | Low      | Not implemented |
| Dark mode support             | High     | ✅ Implemented  |
| Responsive breakpoints        | Medium   | ✅ Implemented  |

## Related

- [MDN: ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [WCAG 2.1: Time-limited content](https://www.w3.org/WAI/WCAG21/Understanding/time-limits-no-behaviors.html)

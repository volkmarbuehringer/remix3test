## 1. Controller — Index Handler

- [x] 1.1 Read `page` from `context.url.searchParams`, parse as int, default to 0
- [x] 1.2 Handle `cancel` param: if present, `session.unset('pendingBooking')` and redirect to clean chat URL
- [x] 1.3 Compute day keys from `pendingBooking.slots`, clamp page to `[0, dayKeys.length - 1]`
- [x] 1.4 Pass `currentPage` and `totalDays` to `CustomerChatPage` props

## 2. Booking Card UI — Single Day Render

- [x] 2.1 Sort `pendingBooking.slots` by date, group into day keys (same as current)
- [x] 2.2 Replace full-day-keys render loop with single-day slice: only render `dayKeys[currentPage]`
- [x] 2.3 Show day header with date display (unchanged format)

## 3. Navigation Row

- [x] 3.1 Add prev link `?page={currentPage - 1}&threadId={threadId}` — hidden/disabled when `currentPage === 0`
- [x] 3.2 Add next link `?page={currentPage + 1}&threadId={threadId}` — hidden/disabled when `currentPage === totalDays - 1`
- [x] 3.3 Add "Tag X/Y" label between nav links showing `{currentPage + 1}/{totalDays}`

## 4. Cancel Button

- [x] 4.1 Add cancel link `?cancel=1&threadId={threadId}` below nav row
- [x] 4.2 Style cancel link as secondary/danger button (matching existing theme)

## 5. Verify

- [x] 5.1 Run existing tests — confirm no regressions (14/14 pass)
- [x] 5.2 Manual check: single day → nav hidden, multi-day → nav works, cancel clears form

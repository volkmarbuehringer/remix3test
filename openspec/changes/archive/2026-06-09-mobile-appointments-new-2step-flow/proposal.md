# Mobile-Optimized Appointments New Flow

## Problem

The `/appointments/new` page is a mobile-exclusive page, but its UX was designed for desktop:

1. **Native `<select>` dropdowns look bad on mobile** — resource names get truncated in iOS wheel pickers, and the generic styling provides no visual hint that options exist.
2. **3-step wizard is too many clicks** — resource (POST) → day (POST) → time+title (POST). Each step requires a form submission with an extra "Weiter" button.
3. **No mobile-specific layout** — the form uses the same two-column grid and compact touch targets as desktop admin pages.

## Goal

Redesign the create flow so it feels native on mobile while staying fully SSR-rendered (no client JS required).

## Proposed Approach

### Step 1: Tappable Resource Cards

Replace the dropdown + "Weiter" button with a list of styled cards. Each card is an `<a>` link — tapping immediately navigates to step 2 with `resource_id` set in the URL.

- No form, no submit button
- Zero JS — pure SSR navigation
- Each card shows the resource name and optionally availability hints (day/time ranges)

### Step 2: Combined Day + Time + Title

Merge current steps 2 and 3 into a single page. Show available days for the selected resource within a weekly window. Each day displays inline time chip buttons. A title field sits below the day list. One form submission creates the appointment.

- Week navigation via pagination-style "Vorherige / Nächste" links
- Default to current week
- "Vorherige" disabled on current week (no past booking)
- Pre-compute all time slots for the visible week from `appointoffering` data

## Impact

- 3 POST submissions → 2 interactions (1 link navigation + 1 form POST)
- No dropdowns anywhere in the flow
- Full-width mobile-friendly touch targets
- Maintains SSR rendering — works without JavaScript

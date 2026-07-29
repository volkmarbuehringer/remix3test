## ADDED Requirements

### Requirement: Frame fetches use no-store cache directive

The client-side frame fetch in the runtime entry SHALL request HTML without caching so the browser never serves stale frame content on back/forward navigation.

#### Scenario: Frame fetch sets cache no-store
- **WHEN** the runtime resolves frame content at `app/assets/entry.tsx:45`
- **THEN** the `fetch` call SHALL include `cache: 'no-store'` in its options

#### Scenario: Stale content is never served on back navigation
- **WHEN** a user navigates within a frame, then clicks browser back
- **THEN** the frame SHALL fetch fresh HTML from the server (not serve cached)

#### Scenario: Existing behavior is preserved
- **WHEN** the frame fetch succeeds
- **THEN** headers, signal, X-Remix-Frame, X-Remix-Target, and X-Agent-Prefill behavior SHALL be unchanged
- **THEN** the response SHALL still be returned as `response.body` or `response.text()`

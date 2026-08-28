## REMOVED Requirements

### Requirement: Client renders structured question options

**Reason**: This requirement named `app/assets/route-agent-stream.tsx` as the client entry. The route agent is retired, so the requirement is removed. The structured question UI capability lives on through the support-agent client entry (`app/assets/streams/public/support-agent-stream.tsx`), which renders the same `question` SSE events.

**Migration**: The shared question-UI behavior remains available in the support agent; no client change is needed.

#### Scenario: single_select options render as radio buttons

- **WHEN** a `question` SSE event arrives with `options` containing 2+ entries and `selectionMode: "single_select"`
- **THEN** the `#agent-bar` element SHALL display each option's `label`
- **AND** each option SHALL be rendered as a radio button
- **AND** if an option has a `description`, it SHALL be displayed alongside the label
- **AND** a confirm button SHALL be displayed below the options
- **AND** clicking the confirm button with a selected option SHALL call `handleAnswer` with the selected label

#### Scenario: multi_select options render as checkboxes

- **WHEN** a `question` SSE event arrives with `options` containing 2+ entries and `selectionMode: "multi_select"`
- **THEN** each option SHALL be rendered as a checkbox
- **AND** the confirm button SHALL send all selected labels as a JSON array via `handleAnswer`

#### Scenario: question without options falls back to text input

- **WHEN** a `question` SSE event arrives with `options` set to `null` or an empty array
- **THEN** the client SHALL fall back to a text input for the answer

#### Scenario: selected label is sent as the answer

- **WHEN** the user selects an option and clicks confirm
- **THEN** `handleAnswer` SHALL receive the selected option's `label` as a string (single_select) or JSON array of strings (multi_select)
- **AND** the answer SHALL be sent via `POST /answer` with the label value
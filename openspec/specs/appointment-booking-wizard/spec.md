# Appointment Booking Wizard

## Purpose
Provide a step-by-step wizard for creating appointments with resource selection, day selection based on offerings, and full-hour time slot selection.

## Requirements

### Requirement: User selects resource in wizard step 1

The system SHALL present a resource dropdown as the first wizard step with a "Weiter" submit button. Submitting advances to step 2.

#### Scenario: Step 1 shows resources and advances to step 2
- **WHEN** user opens the create form
- **THEN** the page shows a resource dropdown and a "Weiter" button
- **WHEN** user selects a resource and clicks "Weiter"
- **THEN** the form POSTs and advances to step 2 showing available days for that resource

#### Scenario: Step 1 validates resource selection
- **WHEN** user clicks "Weiter" without selecting a resource
- **THEN** the page re-renders step 1 with a validation error

### Requirement: User selects day in wizard step 2

The system SHALL present a list of days that have at least one offering for the selected resource. Each day entry SHALL show the date and the offering time ranges (e.g., "08:00–18:00"). Days without offerings SHALL NOT appear.

#### Scenario: Step 2 shows days with offerings
- **WHEN** user advances from step 1 with resource_id=3
- **THEN** the page shows only days where `appointoffering` has entries for resource_id=3
- **THEN** each day entry shows the offering time range as subtitle

#### Scenario: Step 2 shows "Keine verfügbaren Tage"
- **WHEN** the selected resource has no offerings in the current period
- **THEN** the page displays "Keine verfügbaren Tage in diesem Zeitraum"

#### Scenario: User can change period in step 2
- **WHEN** user clicks "Nächste Woche" in step 2
- **THEN** the page reloads (GET) showing days for next week
- **WHEN** user clicks a period button
- **THEN** the selected resource is preserved in the URL

#### Scenario: Step 2 advances to step 3
- **WHEN** user selects a day and clicks "Weiter"
- **THEN** the form POSTs and advances to step 3 showing available times for that resource+day

#### Scenario: User can go back from step 2 to step 1
- **WHEN** user clicks "Zurück" in step 2
- **THEN** the form POSTs back to step 1 with the previously selected resource pre-selected

### Requirement: User selects time and enters title in wizard step 3

The system SHALL present a time dropdown showing only full-hour start times that fit within at least one offering range for the selected resource+day. The title input SHALL also be shown. A gap between offerings SHALL be communicated via a visual separator or absence of options.

#### Scenario: Step 3 shows only bookable full-hour slots
- **WHEN** user advances from step 2 with resource_id=3 and day=2024-03-18
- **THEN** the time dropdown contains only `start_min` values where `start_min` is a multiple of 60 and `[start_min, start_min+60)` falls within an offering

#### Scenario: Offering gap hides in-between hours
- **GIVEN** resource 3 has offerings `[480,720)` and `[780,1080)` on 2024-03-18
- **WHEN** user reaches step 3
- **THEN** the dropdown includes 480–660 (08:00–11:00) and 780–1020 (13:00–17:00)
- **THEN** 720 (12:00) is NOT in the dropdown

#### Scenario: No valid time slots shows error
- **WHEN** the selected resource+day has no full-hour slot fitting within an offering
- **THEN** the page displays "Keine verfügbaren Zeitfenster an diesem Tag"

#### Scenario: Step 3 creates the appointment
- **WHEN** user fills all fields and clicks "Anlegen"
- **THEN** the form POSTs, validates, and creates the appointment
- **THEN** the user is redirected to the appointment list with the new appointment selected

#### Scenario: User can go back from step 3 to step 2
- **WHEN** user clicks "Zurück" in step 3
- **THEN** the form POSTs back to step 2 with the previously selected day pre-selected

### Requirement: Wizard step tracking uses hidden inputs

The system SHALL track the current wizard step via a hidden `<input name="step">` in every wizard form. Prior selections (resource_id, day) SHALL be carried forward as hidden inputs.

#### Scenario: Hidden inputs carry state between steps
- **WHEN** user submits step 1
- **THEN** the server re-renders with hidden input `step=1` replaced by visible step 2 content and hidden `resource_id` carrying forward the selection
- **WHEN** user submits step 2
- **THEN** the server re-renders with hidden `resource_id` + `day` carrying forward

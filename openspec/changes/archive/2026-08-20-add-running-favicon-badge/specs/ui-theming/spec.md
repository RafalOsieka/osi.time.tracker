## ADDED Requirements

### Requirement: REQ-268 Favicon reflects idle vs running timer
The document favicon SHALL follow the shared running-timer state (the same `running` entry used by the shell widget, REQ-146 / REQ-258). When there is no running entry (including unauthenticated visits and an authenticated idle timer), the favicon SHALL be the default brand app icon from REQ-267. When a running entry is present, the favicon SHALL be a **static** variant of that same app icon with a green status dot in the bottom-right corner and a contrasting ring so the dot remains visible on the cyan square. The variant SHALL NOT pulse, animate, or replace the brand glyph with a play control.

The running variant SHALL apply as soon as running state is known, including first paint of an authenticated page whose SSR seed already contains a running entry. Stopping the timer, or otherwise clearing the running entry, SHALL restore the default favicon in that tab. Other open tabs are not required to update until they next resolve running state. The in-app brand mark (sidebar and login heading) SHALL remain the unbadged glyph.

#### Scenario: Idle and logged-out use the default favicon
- **WHEN** there is no running entry (logged-out visitor, or authenticated user with an idle timer)
- **THEN** the document favicon SHALL be the default brand app icon

#### Scenario: Running entry shows a green-dot favicon
- **WHEN** the authenticated user has a running entry
- **THEN** the document favicon SHALL be the brand app icon with a static green corner dot

#### Scenario: Stop restores the default favicon
- **WHEN** the user stops the running timer in that tab
- **THEN** the document favicon SHALL return to the default brand app icon

#### Scenario: Reloading a running timer shows the badged favicon on first paint
- **WHEN** an authenticated user with a running entry performs a full document load
- **THEN** the initial document favicon SHALL be the running (green-dot) variant rather than flashing the idle icon until a client-only fetch

#### Scenario: In-app mark is not badged
- **WHEN** a timer is running
- **THEN** the sidebar and login brand mark SHALL remain the unbadged glyph

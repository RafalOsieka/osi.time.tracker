# tracking-dashboard

## Purpose

Show the user where their time went: the Dashboard at `/` sums up their completed Time entries over a chosen week, month or year. It reads only local data and never contacts a Tracker.

## Requirements

### Requirement: Dashboard endpoint

`GET /api/dashboard` SHALL return, for the authenticated user: the resolved period (kind, first and last day), today, the timezone, the first day of the week (1 Monday to 7 Sunday), whether the account has any Time entry, and the summary. Durations SHALL be whole seconds and days calendar dates. It follows `core-api-conventions`.

#### Scenario: Empty account and empty period

- **WHEN** the period has no Time entries
- **THEN** the response SHALL tell whether the account has any Time entry outside the period

### Requirement: Period query

The query SHALL accept an optional `period` (`week`, `month` or `year`) and an optional `date`, any local calendar day of the wanted period from `0002-01-01` to `9998-12-31`. Without `period` the kind SHALL be a month; without `date` the period SHALL be the one containing today in the user's timezone (`workspace-settings`). Anything else SHALL be rejected with 422 and a `{ messageKey, params }` body.

#### Scenario: Default is the current month

- **WHEN** the endpoint is called without a query
- **THEN** it SHALL return the calendar month containing today in the user's timezone

#### Scenario: Date selects the period around it

- **WHEN** the query is `period=year&date=2024-02-10`
- **THEN** the period SHALL be 2024-01-01 to 2024-12-31

#### Scenario: Invalid query

- **WHEN** the query has `period=day`, a repeated `period`, `date=2026-02-30` or an empty `date`
- **THEN** it SHALL respond with 422 and `error.dashboardPeriodInvalid` or `error.dashboardDateInvalid`

### Requirement: First day of the week

Weeks SHALL start on the day usual in the country of the user's timezone, and on Monday when the timezone has no country. The first day SHALL NOT be stored or offered as a setting.

#### Scenario: Monday country

- **WHEN** the timezone is `Europe/Warsaw` and the week of 2026-08-05 is requested
- **THEN** the period SHALL be 2026-08-03 to 2026-08-09

#### Scenario: Sunday country

- **WHEN** the timezone is `America/New_York` and the week of 2026-08-05 is requested
- **THEN** the period SHALL be 2026-08-02 to 2026-08-08

#### Scenario: Timezone without a country

- **WHEN** the timezone is `UTC`
- **THEN** weeks SHALL start on Monday

### Requirement: Period summary

The summary SHALL hold the total time, the number of days with entries and the average per day with entries, rounded to whole seconds. Only completed Time entries SHALL count, each wholly on the local day of its start. An entry shorter than one second SHALL NOT make its day a day with entries. Without days with entries all three SHALL be zero.

#### Scenario: Average skips days without entries

- **WHEN** a month has 2:00 on one day and 2:00 on another
- **THEN** the total SHALL be 4:00, the days with entries 2 and the average 2:00

#### Scenario: Entry across midnight

- **WHEN** an entry starts at 23:30 on the last local day of August and stops on September 1
- **THEN** its whole duration SHALL count in August and none of it in September

#### Scenario: Last day without a midnight

- **WHEN** the clocks skip midnight on the last day of the period, so that it starts at 01:00
- **THEN** an entry started on the following day SHALL NOT count in the period

#### Scenario: Entry shorter than a second

- **WHEN** a day's only entry is shorter than one second
- **THEN** that day SHALL NOT count as a day with entries

#### Scenario: Running time entry is excluded

- **WHEN** the only Time entry is running
- **THEN** the summary SHALL be zero

### Requirement: Dashboard period in the URL

The page SHALL offer week, month and year, and SHALL show the period in the user's language. Choosing a period SHALL put `period` and `date` in the URL as a new history entry; `/` without them SHALL be the current month.

#### Scenario: Reload and back

- **WHEN** the user reloads the page, or goes back after changing the period
- **THEN** the page SHALL show the period the URL names

#### Scenario: Invalid period in the URL

- **WHEN** the URL holds an invalid `period` or `date`
- **THEN** the page SHALL show a translated error instead of a summary, and choosing a kind SHALL lead to a valid period

### Requirement: Stepping between periods

The page SHALL offer the previous and the next period of the shown kind. Stepping past the period containing today SHALL be unavailable.

#### Scenario: Stepping back

- **WHEN** the user activates the previous period while viewing April 2026
- **THEN** the page SHALL show March 2026 with `period=month` and a date in March in the URL

#### Scenario: Current period has no next

- **WHEN** the shown period contains today or lies after it
- **THEN** the next-period control SHALL be disabled

### Requirement: Switching the kind of period

Changing the kind SHALL open the period around today when the shown one contains today, and otherwise the one around the date in the URL.

#### Scenario: From the current month

- **WHEN** the user picks week while viewing the month that contains today
- **THEN** the page SHALL show the week that contains today

#### Scenario: From a past month

- **WHEN** the user picks week on `/?period=month&date=2026-03-17`
- **THEN** the page SHALL show the week that contains 2026-03-17

### Requirement: Summary tiles

The page SHALL show the total and the average as unpadded `H:MM` and the days with entries as a number. All text SHALL have `en`/`pl` parity; the Polish name of the page is _Pulpit_. The page SHALL fit a phone without sideways scrolling.

#### Scenario: Summary of a month

- **WHEN** a month has 2:00 on one day and 3:30 on another
- **THEN** the page SHALL show `5:30`, `2` and `2:45`

### Requirement: Dashboard states

Loading, a failed load, a period without entries and an account without entries SHALL be distinct states. A full page load SHALL have its data in the first paint (`ui-routing`). The figures SHALL stay as loaded until the user changes the period, reloads or comes back to the page.

#### Scenario: Loading

- **WHEN** the data for the requested period is still pending
- **THEN** the page SHALL show placeholders marked as busy, and neither figures, an error nor an empty state

#### Scenario: Failed load

- **WHEN** the request fails
- **THEN** the page SHALL show a translated error instead of the summary, and choosing the selected kind again SHALL retry

#### Scenario: Period without entries

- **WHEN** the period has no days with entries but the account has Time entries
- **THEN** the page SHALL show zeros and a short message

#### Scenario: Account without entries

- **WHEN** the account has no Time entry at all, completed or running
- **THEN** the page SHALL show a message with a control that leads to `/timer`, and no summary

# tracking-dashboard

## Purpose

Show the user where their time went: the Dashboard at `/` sums up their completed Time entries over a chosen week, month or year. It reads only local data and never contacts a Tracker.

## Requirements

### Requirement: Dashboard endpoint

`GET /api/dashboard` SHALL return, for the authenticated user: the resolved period (kind, first and last day), today, the timezone, the first day of the week (1 Monday to 7 Sunday), whether the account has any Time entry, the summary, the buckets of the period and its groups. Durations SHALL be whole seconds and days calendar dates. It follows `core-api-conventions`.

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

### Requirement: Buckets

The response SHALL list every bucket of the period in order, with time or without: each day of a week or month, and the first day of each month of a year. Each group SHALL carry its time per bucket, counted like the summary.

#### Scenario: Days of a month

- **WHEN** August 2026 is requested
- **THEN** there SHALL be 31 buckets, 2026-08-01 to 2026-08-31

#### Scenario: Months of a year

- **WHEN** a Project has 1:30 on August 3 and 2:00 on August 31, and that year is requested
- **THEN** there SHALL be 12 buckets and the Project's group SHALL have 3:30 in 2026-08-01

### Requirement: Groups

The response SHALL group the period's time both by Project and by Tracker, each group with its total, largest first; equal groups in creation order, the ones without a name last. Only groups with time SHALL be listed, and the times of either grouping SHALL add up to the total.

#### Scenario: By Project

- **WHEN** the period has time in two Projects, on a Task without a Project and in an entry without a Task
- **THEN** there SHALL be one group per Project and one "No project" group with the other two

#### Scenario: By Tracker

- **WHEN** the period has time in two Projects of one Tracker, in two Local projects and without a Project
- **THEN** there SHALL be one group for the Tracker, one "Local" group and one "No project" group

#### Scenario: Equal groups

- **WHEN** two Projects and the time without a Project are equally large
- **THEN** the older Project SHALL come first and "No project" last

#### Scenario: Entry shorter than a second

- **WHEN** a Project's only entry is shorter than one second
- **THEN** the Project SHALL have no group

### Requirement: Group colors

Each group SHALL carry a palette slot from 0 to 5, or none. Only the six largest groups other than "No project" SHALL have one. A group SHALL want the slot of its place in creation order among all the user's Projects, or Trackers with "Local" last, deleted ones included, counted modulo six. Of two groups that want one slot, the older SHALL keep it and the other SHALL take the next slot no group wants or holds. The ranking SHALL NOT change a slot.

#### Scenario: Slot by creation order

- **WHEN** the user's third Project has time in a period
- **THEN** its group SHALL have slot 2, whatever its rank among the six largest

#### Scenario: Two groups want one slot

- **WHEN** the first and the seventh Project, both among the six largest, want slot 0 and slot 1 is held by the second Project
- **THEN** the first SHALL have slot 0 and the seventh slot 2

#### Scenario: More than six groups

- **WHEN** a period has time in eight Projects and without a Project
- **THEN** the six largest Projects SHALL have a slot, and the two smallest and "No project" SHALL have none

#### Scenario: Local after the Trackers

- **WHEN** the user has created three Trackers, one of them deleted since, and the period has time in Local projects
- **THEN** the "Local" group SHALL want slot 3

### Requirement: Deleted Projects and Trackers

Soft-deleted Projects and Trackers SHALL keep their groups and names, marked as deleted.

#### Scenario: Deleted and created again

- **WHEN** a Project with time is deleted and another one with the same name has time too
- **THEN** there SHALL be two groups with that name, the first marked as deleted

#### Scenario: Deleted Tracker

- **WHEN** a Tracker with time is deleted and its Project is not
- **THEN** the Tracker's group SHALL be marked as deleted and the Project's SHALL NOT

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

### Requirement: Groups table

The page SHALL list every group in a captioned table with its name, its time as unpadded `H:MM` and its share of the total as a whole percentage in the user's language, in the order of the response. A deleted group SHALL say so in text.

#### Scenario: Shares

- **WHEN** a Project has 3:45 of a total of 7:30
- **THEN** its row SHALL show `3:45` and `50%`

#### Scenario: Deleted group

- **WHEN** a group is marked as deleted
- **THEN** its row SHALL show its name and the word "deleted" in the user's language

#### Scenario: Reading a column

- **WHEN** a screen reader moves down the times or shares
- **THEN** each SHALL be announced with its group's name

### Requirement: Time chart

Beside the groups table the page SHALL show stacked columns, one per day of a week or month and one per month of a year, with an axis in whole hours. A column SHALL stack, from the bottom, the groups with a slot largest first, then "Other" with the time of every other named group, then "No project", with a gap between segments. Below a narrow screen's width the chart SHALL scroll in its own box, never the page.

#### Scenario: A week

- **WHEN** a week has 2:00 in a Project and 1:00 without a Project on Monday, and nothing on the other days
- **THEN** the chart SHALL have seven columns, Monday's with the Project below "No project"

#### Scenario: Smaller groups fold into Other

- **WHEN** a day has time in eight Projects and without a Project
- **THEN** its column SHALL have the six largest Projects in color, one "Other" segment with the two smallest and "No project" on top

#### Scenario: Phone

- **WHEN** a month is shown on a phone
- **THEN** its columns SHALL scroll inside the chart, and the page SHALL NOT scroll sideways

### Requirement: Chart colors

Each slot SHALL have its own color, and "Other" and "No project" two neutral shades, each with separate values for light and dark mode that stay apart under the common color vision deficiencies. The groups table SHALL mark each group with the color it is drawn in, a group without a slot with the color of "Other". No group SHALL be told apart by color alone: names and times are in the table, the tooltip and each column's name.

#### Scenario: Same group in another period

- **WHEN** a Project with a slot has a slot in another period too and no older group wants it there
- **THEN** it SHALL have the same color in both periods

### Requirement: Moving through the chart

The chart SHALL be one tab stop. Left and right arrows SHALL move between columns, Home and End to the first and the last, and tabbing back into the chart SHALL return to the column left last.

#### Scenario: Keyboard

- **WHEN** the user tabs into the chart of April 2026 and presses the right arrow
- **THEN** the column of April 2 SHALL have the focus

#### Scenario: Coming back

- **WHEN** the user leaves the chart on April 2 and tabs back into it
- **THEN** the column of April 2 SHALL have the focus

### Requirement: Column breakdown

Hovering or focusing a column SHALL show its day or month, its total and the time of each segment, as unpadded `H:MM`. The pointer SHALL be able to move onto the breakdown without hiding it, and Escape SHALL hide it wherever the focus is. Each column's accessible name SHALL hold the same numbers. All text SHALL have `en`/`pl` parity.

#### Scenario: Focus

- **WHEN** the column of April 2 receives the focus
- **THEN** its breakdown SHALL show until the focus leaves the chart

#### Scenario: Escape

- **WHEN** the user hovers a column while the focus is elsewhere and presses Escape
- **THEN** the breakdown SHALL hide until the pointer moves to another column

#### Scenario: Accessible name

- **WHEN** a screen reader reaches the column of Wednesday, April 1, with 2:00 in "Books" and 1:00 without a Project
- **THEN** it SHALL announce "Wed, Apr 1: 3:00, of which Books 2:00, No project 1:00"

#### Scenario: Empty column

- **WHEN** a day has no time
- **THEN** its column SHALL be empty and its name SHALL give the day and `0:00`

#### Scenario: Server render

- **WHEN** the page is loaded in full
- **THEN** the chart SHALL arrive complete from the server and SHALL NOT move or change when the page becomes interactive

### Requirement: Switching the grouping

The page SHALL offer grouping by Project, the default, and by Tracker, operable by keyboard and announcing which one is selected. Switching SHALL make no request and SHALL NOT change the URL. The choice SHALL last while the user stays on the page, also across periods.

#### Scenario: Switch to Trackers

- **WHEN** the user picks Tracker
- **THEN** the chart and the table SHALL show the Tracker groups of the same period

#### Scenario: Another period

- **WHEN** the user picks Tracker and steps to another period
- **THEN** the table SHALL list the Tracker groups of that period

### Requirement: Dashboard states

Loading, a failed load, a period without entries and an account without entries SHALL be distinct states. A full page load SHALL have its data in the first paint (`ui-routing`). The figures SHALL stay as loaded until the user changes the period, reloads or comes back to the page.

#### Scenario: Loading

- **WHEN** the data for the requested period is still pending
- **THEN** the page SHALL show placeholders marked as busy, and neither figures, an error nor an empty state

#### Scenario: Failed load

- **WHEN** the request fails
- **THEN** the page SHALL show a translated error instead of the summary, the chart and the groups, and choosing the selected kind again SHALL retry

#### Scenario: Period without entries

- **WHEN** the period has no days with entries but the account has Time entries
- **THEN** the page SHALL show zeros and a short message, and neither the chart nor the groups

#### Scenario: Account without entries

- **WHEN** the account has no Time entry at all, completed or running
- **THEN** the page SHALL show a message with a control that leads to `/timer`, and no summary

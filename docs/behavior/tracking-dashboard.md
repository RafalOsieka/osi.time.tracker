# tracking-dashboard

## Purpose

Show the user where their time went: the Dashboard at `/` sums up their completed Time entries over a chosen week, month or year, shows their days over the past year and the hours they usually work, and points out recent days not yet Sent. It reads only local data and never contacts a Tracker.

## Requirements

### Requirement: Dashboard endpoint

`GET /api/dashboard` SHALL return, for the authenticated user: the resolved period (kind, first and last day), today, the timezone, the first day of the week (1 Monday to 7 Sunday), whether the account has any Time entry, the summary, the buckets of the period, its groups, its top Tasks, the days of the Export backlog, the time per day of the past year and the average time per weekday and hour. Durations SHALL be whole seconds and days calendar dates. It follows `core-api-conventions`.

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

### Requirement: Top Tasks

The response SHALL list the ten Tasks with the most time in the period, most first, equal ones in creation order, counted like the summary. Each SHALL be one Task identity (`workspace-tasks`) with its name, its Project or none, marked as deleted when it is, its Remote issue or none, and its time. An issue SHALL carry its id, its cached title and its address in its Tracker, the address only while that Tracker is active. Untitled entries belong to no Task and SHALL NOT be listed.

#### Scenario: Days merged

- **WHEN** a Task has 1:00 on one day and 2:00 on another
- **THEN** it SHALL be one row with 3:00

#### Scenario: Same name, different Remote issues

- **WHEN** two Tasks of one Project share a name and only one is linked to a Remote issue
- **THEN** they SHALL be two rows, only one with the issue

#### Scenario: More than ten Tasks

- **WHEN** a period has time in twelve Tasks
- **THEN** the ten with the most time SHALL be listed

#### Scenario: Untitled time

- **WHEN** the largest time of the period is in untitled entries
- **THEN** it SHALL NOT be listed

#### Scenario: Deleted Tracker

- **WHEN** a Task's Remote issue belongs to a deleted Tracker
- **THEN** the issue SHALL be listed without an address

### Requirement: Export backlog

The response SHALL list the days of the Export backlog among the 30 local days before today, oldest first, whatever the period. A day SHALL be listed when a Task has Tracked time above zero on it, in a Project whose Tracker is active, and no Export record (`remote-sync-export`) for that day. Exported, matched and imported days SHALL count as Sent. Time in Local projects, without a Project or a Task, or on a soft-deleted Tracker SHALL NOT list a day.

#### Scenario: Window

- **WHEN** a Task has unsent time today, 1, 30 and 31 days ago
- **THEN** the list SHALL be the days 30 and 1 days ago

#### Scenario: Every Task of the day

- **WHEN** a day has two Tasks and only one of them has an Export record
- **THEN** the day SHALL be listed until the other has one too

#### Scenario: Another day of the Task

- **WHEN** a Task has an Export record for one day and unsent time on another
- **THEN** the other day SHALL be listed

#### Scenario: Time that cannot be exported

- **WHEN** a day's only time is in a Local project, without a Project, untitled, on a deleted Tracker or shorter than a second
- **THEN** the day SHALL NOT be listed

#### Scenario: Deleted Project

- **WHEN** a Project is deleted while its Tracker is active
- **THEN** its unsent time SHALL list its days

### Requirement: Past year

The response SHALL hold the time of each local day of the past year, whatever the period: the days from the day after today's date a year earlier up to and including today, as the first day, the last day and one value per day in order, counted like the summary.

#### Scenario: Window

- **WHEN** today is 2026-11-24
- **THEN** the past year SHALL cover 2025-11-25 to 2026-11-24 with 365 values

#### Scenario: Today is a leap day

- **WHEN** today is 2028-02-29
- **THEN** the past year SHALL start on 2027-03-01

#### Scenario: Entries counted

- **WHEN** a day has two completed entries of 1:00 and 0:30, another an entry from 23:00 to 01:00, and today a running entry
- **THEN** the first day SHALL have 1:30, the day the second entry started 2:00, and the running entry SHALL NOT count

#### Scenario: Any period

- **WHEN** the query asks for a week in another year
- **THEN** the past year SHALL be the same as without a query

### Requirement: Weekday by hour

The response SHALL hold, whatever the period, the average time per weekday and local hour over the 84 local days before today, today left out, so that each weekday occurs twelve times: the first and the last day and, for each weekday from Monday, 24 hours from midnight, each the time in that hour divided by twelve. Completed Time entries SHALL be cut where the local hour changes and clipped to the window; imported entries SHALL count like any other.

#### Scenario: Window

- **WHEN** today is 2026-11-24
- **THEN** the window SHALL cover 2026-09-01 to 2026-11-23

#### Scenario: Entry over several hours

- **WHEN** an entry runs from 09:15 to 11:45 on a Monday and another from 09:00 to 10:00 a week earlier
- **THEN** Monday's hours at 9, 10 and 11 SHALL have 525, 300 and 225 seconds, a twelfth of 105, 60 and 45 minutes

#### Scenario: Across midnight and the window's edges

- **WHEN** an entry runs from 23:30 yesterday into today, another from 23:00 the day before the window into its first day, and an entry is running
- **THEN** only the half hour before midnight and the hour after the window's start SHALL count

#### Scenario: Clocks go forward

- **WHEN** an entry runs from 01:30 to 03:30 on the clock on the night the clocks skip 02:00 to 03:00
- **THEN** it SHALL add 30 minutes at 1 and 30 minutes at 3, and nothing at 2

#### Scenario: Clocks go back

- **WHEN** an entry runs from 01:30 to 03:30 on the clock on the night the clocks go back from 03:00 to 02:00
- **THEN** it SHALL add 30 minutes at 1, 120 minutes at 2 and 30 minutes at 3

#### Scenario: Imported time

- **WHEN** a Remote log of 1:30 is imported for a day in the window, and placed from 08:00
- **THEN** it SHALL count 60 minutes at 8 and 30 minutes at 9 like an entry of the Timer

### Requirement: Export backlog line

When the Export backlog has days, the page SHALL show one line labelled with the term Export backlog (_Zaległy eksport_), listing each day as a short date in the user's language that links to its Remote Sync page (`remote-sync-review`). The line SHALL show no categories, hours or dismiss action, and SHALL stay the same across periods. All text SHALL have `en`/`pl` parity.

#### Scenario: Days waiting

- **WHEN** October 30 and November 12 are in the Export backlog
- **THEN** the line SHALL link `Oct 30` to `/sync/2026-10-30` and `Nov 12` to `/sync/2026-11-12`

#### Scenario: Nothing waiting

- **WHEN** the Export backlog has no days
- **THEN** the line SHALL be absent

#### Scenario: Failed load

- **WHEN** the request fails
- **THEN** the line SHALL be absent

### Requirement: Top Tasks list

The page SHALL list the top Tasks in a captioned table, in the order of the response, each with its name, its Project or "No project", the word "deleted" for a deleted Project, its Remote issue as `#` and its id, and its time as unpadded `H:MM`. An issue with an address SHALL link to it in a new tab. Hovering or focusing an issue SHALL show its title, which SHALL also be part of its accessible name. All text SHALL have `en`/`pl` parity.

#### Scenario: Linked Task

- **WHEN** a Task is linked to issue 42 of an active Tracker
- **THEN** its row SHALL link `#42` to the issue

#### Scenario: Task without a Remote issue

- **WHEN** a Task has no Remote issue
- **THEN** its row SHALL show its name, Project and time without a link

#### Scenario: Only untitled time

- **WHEN** the period has entries but no Task
- **THEN** the page SHALL show a short message instead of the list

### Requirement: 12-month heatmap

Below the period sections the page SHALL show the past year as a grid with a column per week and a row per weekday, the rows from the first day of the week, labelled with short weekday names and the months whose first day falls in a column. The heatmap SHALL stay the same across periods. All text SHALL have `en`/`pl` parity.

#### Scenario: Sunday first

- **WHEN** the first day of the week is Sunday
- **THEN** the first row SHALL be Sunday

#### Scenario: Period without entries

- **WHEN** the period has no entries but the past year has
- **THEN** the heatmap SHALL show the past year

#### Scenario: Loading another period

- **WHEN** another period loads
- **THEN** the heatmap SHALL stay as it is

#### Scenario: Failed load or empty account

- **WHEN** the request fails or the account has no Time entry
- **THEN** the heatmap SHALL be absent

#### Scenario: Phone

- **WHEN** the page is shown on a phone
- **THEN** the weeks SHALL scroll inside the heatmap, starting at the latest one with the weekday labels in view, and the page SHALL NOT scroll sideways

### Requirement: Heatmap levels

Each day of the 12-month heatmap SHALL have one of five fixed levels: none, up to 2 h, up to 4 h, up to 8 h and over 8 h, drawn as a sequential scale with separate values for light and dark mode, and taken from the time in whole minutes as shown. A legend SHALL name each level in text.

#### Scenario: Levels

- **WHEN** days have 0:00, 2:00, 2:01, 8:00 and 8:01
- **THEN** they SHALL have the levels none, up to 2 h, up to 4 h, up to 8 h and over 8 h

### Requirement: Moving through the heatmap

The heatmap SHALL be one tab stop, held by today until the user moves it. Up and down arrows SHALL move to the previous and the next day, left and right arrows by a week, Home and End to the first day and today, never past either.

#### Scenario: Keyboard

- **WHEN** the user tabs into the heatmap on 2026-11-24 and presses the left arrow, then the up arrow
- **THEN** 2026-11-16 SHALL have the focus

#### Scenario: Edge

- **WHEN** today has the focus and the user presses the right arrow
- **THEN** today SHALL keep the focus

### Requirement: Reading a heatmap day

Hovering or focusing a day SHALL show its date and its time as unpadded `H:MM`, and each day's accessible name SHALL hold the same. Escape SHALL hide it until the pointer or the focus moves.

#### Scenario: Accessible name

- **WHEN** a screen reader reaches November 18, 2026, with 8:00
- **THEN** it SHALL announce "Wed, Nov 18, 2026: 8:00"

#### Scenario: Hover

- **WHEN** the pointer rests on November 2, 2026, with 1:00
- **THEN** the page SHALL show `Mon, Nov 2, 2026` and `1:00` beside the day

### Requirement: Weekday-by-hour heatmap

Beside the top Tasks, or in their place when the period has none, the page SHALL show the average time per weekday and hour as a grid, a row per weekday from the first day of the week and a column per hour from midnight, labelled with short weekday names and every third hour, and SHALL say that it averages the last 12 weeks. It SHALL stay the same across periods, like the 12-month heatmap while another period loads, and be absent with it. All text SHALL have `en`/`pl` parity.

#### Scenario: Sunday first

- **WHEN** the first day of the week is Sunday
- **THEN** the first row SHALL be Sunday

#### Scenario: Period without entries

- **WHEN** the period has no entries
- **THEN** the heatmap SHALL show the last 12 weeks without the Tasks beside it

#### Scenario: Phone

- **WHEN** the page is shown on a phone
- **THEN** the hours SHALL scroll inside the heatmap, starting at midnight with the weekday labels in view, and the page SHALL NOT scroll sideways

### Requirement: Weekday-by-hour levels

Each hour SHALL have one of five fixed levels on the scale of the 12-month heatmap: none, up to 15, 30, 45 and 60 minutes, taken from the average in whole minutes as shown, the top level holding anything over 45 minutes. A legend SHALL name each level in text.

#### Scenario: Levels

- **WHEN** hours have averages of 59 seconds, 15:59 minutes, 0:16, 0:45, 0:46 and 1:00
- **THEN** they SHALL have the levels none, up to 15, up to 30, up to 45, up to 60 and up to 60 minutes

### Requirement: Moving through the weekday-by-hour heatmap

The heatmap SHALL be one tab stop, held by the first weekday's first hour until the user moves it. Left and right arrows SHALL move to the previous and the next hour, across midnight to the next row, up and down arrows by a weekday, Home and End to the first and the last hour, never past either. Activating an hour SHALL do nothing.

#### Scenario: Keyboard

- **WHEN** Monday is the first row, the user tabs into the heatmap and presses the right arrow, then the down arrow
- **THEN** Tuesday's 1:00 to 2:00 SHALL have the focus

#### Scenario: Across midnight

- **WHEN** Tuesday's first hour has the focus and the user presses the left arrow
- **THEN** Monday's last hour SHALL have the focus

### Requirement: Reading a weekday hour

Hovering or focusing an hour SHALL show its weekday, its hours and its average as unpadded `H:MM`, and each hour's accessible name SHALL hold the same. Escape SHALL hide it until the pointer or the focus moves.

#### Scenario: Accessible name

- **WHEN** a screen reader reaches Monday's 9:00 to 10:00 with an average of 42 minutes
- **THEN** it SHALL announce "Mon, 9:00 AM–10:00 AM: 0:42", and "pon., 9:00–10:00: 0:42" in Polish

### Requirement: Opening a week from the heatmap

Activating a day by click, Enter or Space SHALL open the week that contains it, putting `period=week` and the day as `date` in the URL as a new history entry. The page SHALL scroll to the top and move the focus to the selected kind of period.

#### Scenario: Opening a week

- **WHEN** the user activates 2026-11-19 far down the page
- **THEN** the URL SHALL be `/?period=week&date=2026-11-19`, the page SHALL show that week, scrolled to the top, and the week control SHALL have the focus

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
- **THEN** the page SHALL show a translated error instead of the summary, the chart, the groups and the Tasks, and choosing the selected kind again SHALL retry

#### Scenario: Period without entries

- **WHEN** the period has no days with entries but the account has Time entries
- **THEN** the page SHALL show zeros and a short message, and neither the chart, the groups nor the Tasks

#### Scenario: Account without entries

- **WHEN** the account has no Time entry at all, completed or running
- **THEN** the page SHALL show a message with a control that leads to `/timer`, and no summary

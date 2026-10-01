# Proposal

## Why

A title typed into the top-bar timer or the add-entry dialog always lands in the project-less scope unless the user picks an existing task suggestion. Starting new work in a project means starting the timer and then re-projecting the task group on the timer view: two places for one intent. Users need to name the project while typing the title, without leaving the keyboard.

## What Changes

- Typing `@` at the start of the title or after whitespace switches the existing title overlay into **project mode**. The overlay lists up to 5 of the user's projects that match the text after `@`. Matching ignores case, diacritics and separators. Ranking uses match quality, then tracked time over the last 30 days.
- Picking a project removes the `@…` token from the text and shows a removable **project chip** in the input. Task suggestions are then limited to that project, and the create row reads "(new task in {project})".
- Pressing Start/Save without picking still resolves a typed `@Project Name` when it equals exactly one project's normalized name. Otherwise the text stays literal. There are no stored slugs.
- Start, retitle and save send the chip's project as `projectId`. Picking a suggestion brings that task's project into the chip.
- The add-entry dialog gets the same behaviour. It also binds a picked suggestion by task identity, matching the top bar.
- `GET /api/projects` returns each project's tracked seconds over the last 30 days, which drives ranking.
- The title placeholders mention `@`.

## Non-goals

- A clickable project picker or an empty "no project" chip. `@` is the only entry point.
- Stored project slugs or aliases.
- Untitled entries with a project. The data model keeps the project on the task, so a chip with an empty title is dropped on start.
- Mentions for other entities (remote issues, tags) or in other inputs (timer-view group rename, bulk assign).
- Changing task resolution rules (REQ-137/REQ-142).

## Capabilities

### New Capabilities

- `tracking-project-mentions`: the `@project` mention contract shared by the top-bar timer and the add-entry dialog. It covers the trigger, matching and ranking, the project chip, resolution of typed mentions, the committed `projectId`, accessibility and i18n.

### Modified Capabilities

- `tracking-timer-widget`: REQ-180. The create row and the free-form commit now carry the chip's project instead of always resolving in the project-less scope. Suggestions follow the chip's project. The add-entry dialog binds picked suggestions by task identity.
- `workspace-projects`: a new requirement for per-project recent tracked time on `GET /api/projects`.

## Impact

- **Frontend:** `AppTimer.vue`, `TimerAddEntryDialog.vue`, `app/utils/task-title-menu.ts`, a new mention parsing/matching utility, a projects-for-mentions composable, and `en`/`pl` catalogs.
- **Backend:** `server/api/projects/index.get.ts` (usage aggregate) and `ProjectDto` in `shared/types/project.ts` (additive field).
- **APIs:** additive field on `GET /api/projects`. `POST`/`PATCH /api/time-entries` already accept `projectId` and `taskId`.
- **DB:** no migration. The aggregate uses the existing `time_entries (userId, startedAt)` index.

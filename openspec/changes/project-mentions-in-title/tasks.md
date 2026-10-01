# Tasks

## 1. Backend: recent tracked time on projects (REQ-371)

- [ ] 1.1 Add `recentTrackedSeconds: number` to `ProjectDto` in `apps/web/shared/types/project.ts`, then update every `ProjectDto` producer and test fixture. Verify with `pnpm type-check`.
- [ ] 1.2 In `apps/web/server/api/projects/index.get.ts`, left-join one grouped subquery over `time_entries ⋈ tasks` (user-scoped, `startedAt >= now() - 30 days`, `coalesce(stoppedAt, now())`). Keep name ordering. Verify that `CONSOLA_LEVEL=4` logs a single statement per request.
- [ ] 1.3 Extend `apps/web/test/e2e/api/projects.spec.ts`. Cover summing within 30 days, exclusion of entries older than 30 days, a running entry counting toward now, isolation from other users, unchanged name ordering, and the error scenario (HTTP 401 without a session). Verify with `pnpm test:e2e:api`.

## 2. Frontend: mention logic (REQ-372, REQ-373, REQ-375)

- [ ] 2.1 Create `apps/web/app/utils/title-mention.ts` with `normalizeMentionText`, `findMentionAtCaret`, `rankMentionProjects`, `resolveTypedMention` and `removeMention` (design D2). Verify with `pnpm type-check`.
- [ ] 2.2 Add `apps/web/test/unit/title-mention.spec.ts`. Cover the trigger rule (start, after whitespace, `jan@firma.pl`), diacritics including `ł`, separator equivalence, tier/usage/name ranking, the cap of 5, longest exact word-prefix resolution, ambiguous duplicates, partial non-resolution and whitespace collapsing. Verify with `pnpm test:unit`.
- [ ] 2.3 Extend `buildTaskTitleMenuItems` with the optional `mention` input. It returns a labelled project group whose item `name` is the text without the token, plus tracker context in the label (design D3). The create row label also gets an optional project. Verify by extending `apps/web/test/unit/task-title-menu.spec.ts` with project-mode items, `onSelect` capture and the "(new task in {project})" label, then `pnpm test:unit`.
- [ ] 2.4 Create the `useMentionProjects()` composable (load on demand, keep the last successful list, swallow failures without a toast). Verify with `apps/web/test/unit/use-mention-projects.spec.ts` covering success, a failure that keeps the previous list, and reload, then `pnpm test:unit`.

## 3. Frontend: top-bar timer (REQ-374, REQ-376, REQ-377, REQ-180)

- [ ] 3.1 In `AppTimer.vue`, track the caret (design D8) and switch the overlay to project mode via the builder. Render the chip in the `#leading` slot with a labelled remove button. Filter suggestions by `projectId` when the chip is set (extend `useTaskSuggestions().search` with an optional `projectId`). Verify by extending `apps/web/test/unit/use-task-suggestions.spec.ts` for the `projectId` query.
- [ ] 3.2 Wire commits. Start sends the chip's `projectId`, typed mentions resolve on Start/Enter, and an empty title clears the chip. While running, seed the chip from the running entry, and send an immediate PATCH on pick/remove (extend `updateTitle` in `use-timer.ts` with explicit `projectId`). Verify by extending `apps/web/test/nuxt/use-timer.spec.ts` for the PATCH body.
- [ ] 3.3 Add `en`/`pl` keys (projects group label, "(new task in {project})", remove-chip label, `@` placeholder hint). Verify with `pnpm lint` (i18n parity and no-raw-text).
- [ ] 3.4 Extend `apps/web/test/nuxt/AppTimer.spec.ts`. Cover the `@` mode switch, Escape keeping literal text, Enter picking instead of starting, the chip after a pick with the token stripped, start request bodies (chip, no chip, typed exact mention, empty title), running re-project/remove PATCH, and the accessible name of the chip remove control. Verify with `pnpm test:nuxt`.
- [ ] 3.5 Add an e2e UI journey in `apps/web/test/e2e/ui/timer-project-mention.spec.ts`. Seed a project, type `fix login @<partial>`, pick it, start, and assert that the running entry and the timer view group show the project. Then re-project via `@` while running. Verify with `pnpm test:e2e:ui`.

## 4. Frontend: add-entry dialog (REQ-180, REQ-374, REQ-376)

- [ ] 4.1 In `TimerAddEntryDialog.vue`, reuse the mention builder, chip and `useMentionProjects` (load on open). Track the picked suggestion, and on save send `{ taskId }` while the text equals the picked name, otherwise `{ title, projectId }` with typed-mention resolution. Update the placeholder. Verify by extending `apps/web/test/nuxt/timer-add-entry-dialog.spec.ts` with request bodies for: a picked suggestion, editing after a pick, a chip, a typed exact mention, and an empty title with a chip.
- [ ] 4.2 Extend the timer-view e2e UI journey (`apps/web/test/e2e/ui/timer-view-ui.spec.ts`). Add an entry via the dialog with `@` and assert that the created group shows the project. Verify with `pnpm test:e2e:ui`.

## 5. Docs and integration

- [ ] 5.1 Update `docs/user-stories.md` (timer story acceptance bullets) to describe `@project` mentions. Verify by checking that the wording matches REQ-372–REQ-376.
- [ ] 5.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` and `pnpm test:e2e`, and confirm they are all green. Then run `openspec validate project-mentions-in-title --strict`.

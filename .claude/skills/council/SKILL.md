---
name: council
description: "Put the current work before a council of two delegates (Opus and GPT Sol, run through Junie) and iterate in rounds until both are satisfied: a code review, or a design review of screenshots scored against a target. Use when the user says 'council'."
metadata:
  credits:
    - skill: council
      author: Theo Browne
      organisation: T3
      url: 'https://github.com/t3dotgg/tstack/blob/main/skills/council/SKILL.md'
    - skill: code-review (the two axes, the smell baseline and the sub-agent briefs)
      author: Matt Pocock
      url: 'https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md'
---

A **council** is two **delegates** working the same request independently: `opus` and `gpt-sol`, each at high effort, both run through the Junie CLI. If the user names other members, use those. Every member the user expects must actually sit: if one can't run, report it to the user rather than seating a substitute.

The council does one of three jobs:

- **Code review** (the usual): two axes, Standards and Spec, each scored out of 10.
- **Design review**: screenshots of the app, one axis, Design, scored out of 10 against the user's **target** (e.g. "at least 9/10 from both").
- **Anything else** (a plan, an idea, an OpenSpec change): the same steps with the request and its context pointers as the brief, and no scores.

Each run lives in one **run folder** (`mktemp -d`, outside the repo): `template.md`, then one `r<N>/` per round holding that round's `changes.md`, `brief.md`, `shots/`, and each delegate's `.json`, `.log` and `.md`.

The **spec** is OpenSpec: the change the work implements (`openspec/changes/<name>/`: `proposal.md`, `design.md`, `tasks.md` and its delta specs) and the main specs it touches in `openspec/specs/`. Specs hold observable behaviour only; tooling, build and test details live in `docs/`.

## 1. Settle the work

Before the audit, address outstanding PR comments, fix known issues, and run the relevant checks (the list in `AGENTS.md`, "Pull requests and commits"). The council reviews the work as it stands, so known fixes go in first. If the user is discarding the implementation to explore new ideas, skip fixes to code that's being replaced.

## 2. Write the brief template

Every round's brief comes from `<run>/template.md`, filled in by `scripts/brief.mjs` (step 3). Placeholders: `{{round}}`, `{{folder}}` (the round's `shots/` path) and `{{changes}}` (that round's `changes.md`). Write the template once, and add to it as the run goes on.

### Code review

1. **Pin the fixed point.** Whatever the user names (a commit, branch, tag, `main`, `HEAD~5`); ask if they named none. Check it resolves (`git rev-parse <fixed-point>`) and that `git diff <fixed-point>...HEAD` (three dots: against the merge-base) is not empty. Note the commits: `git log <fixed-point>..HEAD --oneline`.
2. **Find the spec**, in this order: an OpenSpec change named by the user or the branch; an active change under `openspec/changes/` that the commits implement; the main specs under `openspec/specs/` for the area the diff touches. If none fits, ask the user; with no spec, the Spec axis is skipped and reported as "no spec available".
3. **Gather the standards:** `AGENTS.md`, `docs/coding-standards.md`, and `docs/e2e-guideline.md` when the diff touches tests. On top of them goes the **smell baseline** below.

The template carries the diff command and commit list, the spec paths, the standards paths, the smell baseline pasted in full, and both axis briefs:

- **Standards:** "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces (Oxlint, ESLint, Oxfmt, the type-check). End with `Score: N/10`."
- **Spec:** "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line (and its REQ code) for each finding. End with `Score: N/10`."

The axes stay apart: code can follow every standard and implement the wrong thing, or do exactly what the spec asks and break the conventions. Reporting them separately stops one from masking the other.

**Smell baseline** (Fowler, _Refactoring_, ch. 3). Each is a labelled judgement call ("possible Feature Envy"), never a hard violation; the repo's documented standards override it. Each reads _what it is_ → _how to fix_:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### Design review

The whole app is too much for one review, so a design review judges one **slice**, picked with four switches of the capture (setup in `docs/development.md`, "Screenshots for design reviews"; the screens are in `apps/screenshots/src/screens.ts`):

| Switch       | Values                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `--viewport` | `desktop` (1280 × 800), `tablet` (834 × 1112: navigation in a drawer, lists still wide), `phone` (390 × 844) |
| `--theme`    | `light`, `dark`, `both`                                                                                      |
| `--set`      | `pages` (each page as it opens), `features` (dialogs, popovers, menus, empty and error states)               |
| `--locale`   | `en`, `pl`                                                                                                   |

**Ask for the slice.** When the user's request doesn't name all four, ask for the missing ones (one question each, with the defaults `desktop`, `both`, `pages`, `en` offered first) before writing the template. Only the design review asks; a code review or anything else never does.

The whole design pass runs as a sequence of slices, each its own run folder:

1. per size, desktop first, then tablet, then phone: `pages`, then `features`, both themes. Desktop is where the app is mostly used, and its decisions shape the narrower layouts;
2. `pl`, `pages`, light, per size: Polish copy is longer and truncates first;
3. a **regression sweep**: `pages`, light, all three sizes captured into the same `shots/` folder (one capture per size). Its question is "did a later fix break an earlier slice?", not a fresh score; judge it against the earlier runs' screenshots.

**The design log.** One file for the whole pass, outside the repo: `~/.council/<repo folder name>/design-decisions.md`. It holds every rejected recommendation with its reason, and every agreed rule (e.g. "below 640 px, list rows stack"). Read it before writing a template, paste it into every design brief in place of the **kept on purpose** list, and add to it as rounds go. A slice must not reopen a decision an earlier slice made.

The template carries:

- what the product is and who uses it: a self-hosted time tracker for IT consultants, who track time locally and export it to OpenProject or Redmine;
- the bar to judge against, and the slice: its size, themes, set and language;
- the docs, as paths: the main specs behind the screens in the set (`openspec/specs/`), and the UI rules in `docs/coding-standards.md` (Nuxt UI components, accessibility to WCAG 2.1 AA);
- the copy rule: on-screen text names domain concepts with the words of the Domain table in `AGENTS.md` (Tracker, Project, Task, Time entry, Remote sync), in the slice's language; a different word for one of them on screen is a finding;
- the design log, pasted in full;
- `{{folder}}`, and one line per screen saying what it shows, from the capture's `screens-<viewport>-<set>-<locale>.json`;
- "Judge the screenshots against these docs: read no source code."

Capture each round from a freshly started app, so the app's current state is what gets judged: `pnpm --filter @osi/time-tracker-screenshots capture <run>/r<N>/shots --viewport … --theme … --set … --locale …`. The `screens-*.json` files also give `report.json` its `themes` and `screens`. A screen added to `screens.ts` mid-run costs a round, since scores dip while it catches up; add the screens that matter before round 1.

### Every template

Also carries:

- **Rules:** read-only; write no files, not even notes or plans; **never use plan mode** (Junie's planning workflow writes `.junie/plans/` and ends with no answer).
- **Kept on purpose:** each recommendation you rejected, with its reason, marked "not to be scored down for". A design review carries the design log here instead.
- **What changed** since the last round: `{{changes}}`.
- **Reply shape:** the final message is all that is kept, so the **whole** review goes in it. For a code review, a `## Standards` and a `## Spec` section, each ending in `Score: N/10`. For a design review, per-screen findings, then only what still keeps it below the target, then `Score: N/10`.

The template is done when a delegate with no other context could run the whole review from a brief filled from it.

## 3. Convene

Fill the round's brief, then start both delegates in parallel, in the background, each with its own output paths:

```bash
node .claude/skills/council/scripts/brief.mjs "$RUN" 1        # prints $RUN/r1/brief.md
W=$(cygpath -w "$RUN/r1")
cat "$RUN/r1/brief.md" | env -u PSModulePath cmd //c "junie --skip-update-check --model=opus --effort=high --output-format=json --json-output-file=$W\\opus.json" > "$RUN/r1/opus.log" 2>&1 &
cat "$RUN/r1/brief.md" | env -u PSModulePath cmd //c "junie --skip-update-check --model=gpt-sol --effort=high --output-format=json --json-output-file=$W\\sol.json" > "$RUN/r1/sol.log" 2>&1 &
```

Write one explicit line per delegate: a loop variable inside the `cmd //c "…"` string can reach Junie unexpanded, and both delegates then write the same JSON file. Three Junie quirks shape the command:

- The `junie` launcher spawns Windows PowerShell 5, which fails (`Could not create a private restart directory`) under PowerShell 7's `PSModulePath`. Unsetting it lets PowerShell 5 rebuild its own.
- Junie needs stdin to be a pipe; with no pipe it fails with `Incorrect function` (`Niepoprawna funkcja`). Piping the brief also keeps it off the command line.
- `--json-output-file` takes a Windows path.

A round takes minutes. Wait for both JSON files, then run `scripts/result.mjs <json> <md>` on each. It saves the review as `r<N>/<delegate>.md` and prints the resolved model (e.g. `claude-opus-5-5`, for the score table), the `sessionId`, the changed files and the score:

- **Exit 2, empty result:** the delegate ran out of steps or drifted into plan mode. Re-run that delegate in a fresh session (no `--session-id`) with the same brief, which is self-contained.
- **Exit 3, changed files:** revert them and report it to the user.
- Compare `git status --short --ignored` with the state before the round: Junie's own writes (e.g. `.junie/`) land in ignored paths that plain `git status` hides. Remove them.

Later rounds pass a delegate's `sessionId` as `--session-id=<id>`, so it remembers what it raised. A resumed session that comes back empty once goes fresh for the rest of the run.

## 4. Report the round

Keep the axes apart: per axis, summarise the findings both delegates raise, the ones only one raises, where they disagree, and the recommended next steps. Give each delegate's score per axis. Don't merge or rerank findings across axes. Each full pass by both delegates is one **round**.

Hand the **report page** to a subagent after every round, so the next round doesn't wait on it: `report/build.mjs` builds it from the run folder and `report.json` (fields in [`report/README.md`](report/README.md)), and the subagent publishes `site/` as a private artifact, patching in the round's new files. For a design review, the page shows each screen next to the same screen from the round before. Give the user the link once, after the first round.

## 5. Iterate

Apply the recommendations you agree with, one commit per round, and name the ones you reject, with the reason. Rejected ones join the template's **kept on purpose** list (in a design review, the design log, along with any rule the round agreed on). Write the round's `changes.md`, then convene a new round (step 3 with each `--session-id`), until both delegates are satisfied, or every delegate meets the target.

Hold the scope to the spec. Before applying a recommendation, check it against the spec, `docs/coding-standards.md` and the Domain table in `AGENTS.md`. One that changes observable behaviour a spec describes, renames a domain concept, or adds behaviour the spec didn't ask for is a **spec delta**: log it in `<run>/spec-delta.md` (the spec and REQ code it touches, before → now) and put it to the user before it lands. An accepted delta goes into the OpenSpec change's delta specs in the same branch, so spec and code stay aligned. A delta the user declines becomes a follow-up, not a change on this branch. When a round raises only findings you've already rejected, stop and put the disagreement to the user.

A subagent stopped by a usage limit keeps its work: once the limit resets, send it a message to continue rather than starting a new one.

## 6. Record

If the work ends in a pull request, put the results in its description, just before the closing attribution line if there is one. Edit the description; the council's results don't go in a comment.

```markdown
## Council review

Rounds: 2

| Delegate        | Axis      | Round 1 | Round 2 |
| --------------- | --------- | ------- | ------- |
| claude-opus-5-5 | Standards | 7/10    | 9/10    |
| claude-opus-5-5 | Spec      | 8/10    | 10/10   |
| gpt-6.1-sol     | Standards | 6/10    | 9/10    |
| gpt-6.1-sol     | Spec      | 8/10    | 9/10    |
```

A design review has one row per delegate, on the Design axis. A delegate that gives no score gets `no score`, with a line under the table saying why. Below the table, list the rejected recommendations with their reasons, and the minor findings left as follow-ups. Every accepted spec delta goes in the description as `## Spec changes`, one line each (the spec and REQ code it touches, before → now). Without a PR, the same results go in the final reply only.

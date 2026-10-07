---
name: compact-specs
description: Compact and clean up the main OpenSpec specs in openspec/specs/ without changing the behavior contract - shorten inflated Purpose sections, split requirements over 500 characters, rewrite transitional wording, merge duplicates, and move tooling/build/upgrade details out of specs while keeping REQ codes traceable. Accepts an optional scope (spec ids or a family prefix). Run only when the user explicitly invokes compact-specs. Do not start it on your own, even if specs look long; suggest it instead.
---

# Compact specs

Make `openspec/specs/` shorter and easier to read while keeping **100% of the behavior contract**. This is a documentation refactor. No system behavior is added, removed or weakened without the user's explicit approval.

Specs grow because every `MODIFIED` delta replaces a whole requirement block and agents tend to append to the description instead of adding a new requirement. Transitional wording ("no longer", "after the upgrade") and tooling details leak in along the way. The risk of compacting is silently losing or weakening a constraint. This workflow guards against that with a snapshot before, a check after every spec, and a decision log.

The work runs as a conversation, one spec at a time. A full plan for every spec at once is too much to review, so the user sees a short overview first and then decides spec by spec.

## Check the facts first

The OpenSpec facts used below were current as of **OpenSpec 1.14.x (2026-10)**:

- the requirement description limit is 500 characters. Since 1.14.1 it is a WARNING (so `validate --strict` fails); in 1.14.0 and earlier it is only INFO,
- `## Purpose` needs at least 50 characters,
- nested spec folders are supported (since 1.7.0),
- `rules.specs` in `config.yaml` applies when the agent merges specs in `/opsx:sync` and `/opsx:archive`, but the plain CLI `openspec archive` ignores it,
- `skip_specs: true` in a change's `.openspec.yaml` marks a change with no behavior change.

Check them against the installed version (`openspec --version`, its docs and changelog) and tell the user about any that no longer hold.

## Project conventions

- Spec ids are flat `<family>-<topic>`. The families and their meaning are listed in `openspec/config.yaml` (`rules.specs`).
- Requirement headers carry a globally unique traceability code: `### Requirement: REQ-<NNN> Title`. The codes are referenced outside `openspec/`, in app code, tests and SQL migrations.
- Retired codes are listed in `docs/retired-requirements.md` (code → what it was → where it went).
- Tooling documentation lives in `docs/`: `development.md` for build, test and CI; `e2e-guideline.md`, `coding-standards.md` and `self-hosting.md` for their topics.
- The sources of truth for tooling are `.github/workflows/*.yml`, the root `package.json` (scripts, `devEngines`) and `pnpm-workspace.yaml` (catalog, overrides).
- Before committing, run `pnpm exec vp fmt` on the touched files and check with `pnpm format:check`.

## Helper script

`scripts/spec-inventory.mjs` (in this skill's folder) measures and compares specs. It is read-only and never writes spec text. Run it from the repository root:

| Command                      | Use                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `overview [spec...]`         | lines, Purpose length, requirements and scenarios, requirements over 500 characters                                                   |
| `index [spec...]`            | Purpose plus one line per requirement (code, title, first sentence), for spotting overlaps between specs without reading them in full |
| `snapshot <file.json>`       | full inventory, the baseline for `diff`                                                                                               |
| `refs`                       | REQ codes referenced outside `openspec/`: dangling codes, retired codes still referenced, retired codes reused in a spec              |
| `diff <file.json> [spec...]` | requirements and scenarios gone or moved since the snapshot, new requirements, and normative sentences whose exact wording is gone    |

`[spec...]` takes spec ids or prefixes such as `tracking-`. Use the script instead of writing your own counting or comparison code.

## Ground rules

1. **Meaning over brevity.** Every `SHALL`/`MUST`/`SHOULD`/`MAY` and every scenario still exists afterwards, in a spec or, for tooling details, in `docs/`, unless the user approved dropping it. Shortening tends to lose qualifiers ("and no account request", "exactly", "per tracker"), so compare normative sentences after every spec, not only at the end.
2. **Keep requirement strength.** `MUST` does not become `SHOULD`, "exactly 3 tabs" does not become "3 tabs", and negative constraints stay.
3. **Keep headers and REQ codes** unless a rename is approved. Archive matches deltas by header name, and code and tests reference the codes. See "REQ codes" below.
4. **No active changes.** Compaction runs only after all changes are archived, because an active delta written against the old text would conflict with the new one. Run `openspec list`. If any active change has deltas in `openspec/changes/*/specs/`, stop and name them.
5. **Write spec text yourself.** Every new sentence is your own wording, edited into the file by hand. No scripts that rewrite or reassemble spec files: they change parts nobody meant to touch (blank lines, wrapping), and the user reviews the diff in a git UI, where that noise hides the real changes. Leave untouched parts of a file exactly as they were. Scripts are fine for mechanical work outside spec text, such as swapping a REQ code in code comments.
6. **A spec that contradicts the code is a decision, not a cleanup.** When the spec describes something the code does not do (a field that does not exist, a different key namespace, "username" where the code uses email), ask whether the spec or the code is wrong. Never align either one silently.

## REQ codes

- **Split:** the original code stays with the main behavior. Each new requirement gets the next free code (highest code in use or retired + 1).
- **Merge of duplicates:** one code survives, and the other is retired. References in code move to the surviving code.
- **Move to docs or drop:** the code is retired. References in code or tests move to a code that still covers the behavior or are removed. Propose which, per reference.
- **Retired codes are never reused**, and each one gets a row in `docs/retired-requirements.md`.
- **Applied SQL migrations are never edited.** If one references a retired code, the retired list is what resolves it.

## Step 1: setup (one round of questions)

Ask these together, before any work:

1. **Commits:** may you commit during the run? If yes, on which branch (propose `docs/compact-specs` or similar) and every how many iterations (default 5).
2. **Standing approvals** for routine changes, so the per-spec questions can focus on real decisions. Offer these and let the user pick:
   - rename a requirement or scenario title that contradicts its own text or names a library,
   - remove library, function, file and component names from spec text when the behavior stays,
   - rewrite transitional wording into the current state,
   - describe one-time data migrations as the end state of an upgraded database,
   - drop scenarios that only verified a past upgrade or redesign ("type-check passes", "works under vN", "existing hooks keep working").
     Changes covered by a standing approval are still listed in each spec's summary; they just do not need a question.
3. **Scope:** all specs, or the scope given when the skill was invoked. Without an explicit scope, propose the specs that fail `validate --strict` or changed since the last commit whose message starts with `docs(specs): compact` (`git log --grep`).

## Step 2: baseline and overview (read-only)

1. Check that `git status` is clean, note `openspec --version`, and check rule 4.
2. Save `openspec validate --specs --strict --json` and `spec-inventory.mjs snapshot` to the scratchpad. The snapshot is the baseline for every later `diff`.
3. Run `spec-inventory.mjs refs` and report dangling codes now, not at the end.
4. Run `overview` and `index` for the scope. Read the index, not every spec in full. Use it to spot specs that overlap or repeat each other (the same rule in several domains, cross-cutting rules such as authentication or error handling restated per spec). When the index suggests an overlap, read just those fragments to confirm.
5. Start the **decision log** in the scratchpad (see the end of this file).
6. Show the overview: one line per spec in scope with lines, Purpose length, overlong requirements, suspected overlaps, and a rough risk. Propose an order (specs others depend on first, e.g. cross-cutting conventions before domain specs). Ask once: "start with X?". No detailed plan at this stage.

## Step 3: one iteration per spec

An iteration is one cycle of: summary and questions → answers → changes applied → check. Usually one spec, or two when merging duplicates between them.

1. **Read the spec in full**, plus fragments of other specs that the index flagged as overlapping.
2. **Find the problems:**
   - **A. Inflated Purpose.** Purpose is 1–3 sentences (≥50 characters) on _why_ the capability exists. Lists of everything inside, change history and cross-references belong elsewhere.
   - **B. Requirement over 500 characters.** Move examples and edge cases into scenarios, or split it into requirements with one behavior each and their own scenarios.
   - **C. Transitional wording** ("no longer", "before this change", "as today", "new", "unchanged"). Describe how things are, keeping the constraint.
   - **D. Implementation details**: class/function/library/component names, table schemas, implementation steps. Remove them when the behavior stays without them; sometimes a name is a real contract (a public endpoint), then it stays.
   - **E. Duplication.** The same behavior in several requirements or specs. Keep it in one canonical place and point to it.
   - **F. Spec too large or covering unrelated surfaces.** Propose a split into separate `<family>-<topic>` specs.
   - **G. Titles and scenarios that do not match their text**, requirements without a scenario, scenarios that only restate the requirement.
   - **H. Tooling, build and upgrade details.** For each one, pick one of three outcomes:
     - **keep as spec** only if someone outside the implementation relies on it and the sentence would still be true with a different tool (e.g. "a pull request cannot merge unless every required check passes"). Rewrite it without tool names, commands or versions;
     - **move to `docs/`** if it tells a contributor something they cannot easily read from the config files. Describe the gate or rule and why, and link to the config file instead of copying versions and commands;
     - **drop** if it repeats what the workflow, `package.json` or other config already says, or only verified a past change. This is the default when in doubt, since the docs review at the end can still bring something back.
       A version that is an external contract (supported runtime for users, browsers, a public API or data format version) stays in the spec.
   - **I. Spec contradicts the code** (rule 6). Always a question.
3. **Summarize in at most ~10 bullets**: what changes, grouped by kind. Mention changes covered by standing approvals in one line each.
4. **Ask 1–3 questions, only about real decisions.** One decision per question. When asking to approve a group of changes, name what they are, not just "points 1–4", so the user can answer without scrolling back. Recommend an option when you have a view.
5. **Apply the approved changes** by hand (rule 5). Write moved content into the agreed `docs/` file in the same iteration. Update REQ references outside `openspec/` and `docs/retired-requirements.md`.
6. **Check this spec right away:**
   - `openspec validate <spec> --strict`,
   - `spec-inventory.mjs diff <snapshot> <spec>`: every gone or moved requirement or scenario must be in the decision log, and every listed normative sentence must have its meaning, qualifiers and strength preserved in the new wording. Fix what was lost before moving on.
7. **Update the decision log.**

## Every 5 iterations (or the agreed number)

1. **Status** for the user, short:
   - progress: specs done / in scope (percentage), lines before → after so far,
   - REQ codes added and retired so far,
   - decisions still open, and the specs left in order.
2. **Commit**, if the user allowed it in step 1: format the touched files, then one commit for the batch, following the repository's commit conventions (e.g. `docs(specs): compact the tracking specs`). If commits are not allowed, say the batch is ready to commit.

## Step 4: docs review

After the last spec, review everything this run added to `docs/`, because moving tooling details out of specs can bloat the docs instead. Show the additions grouped by file, each with the REQ code it came from. For each file, ask: keep as is, shorten, or remove. Docs that only repeat config files are candidates for removal. Apply the answers, keeping `docs/retired-requirements.md` consistent with what remains (a retired code may point to "dropped" instead of a docs section).

## Step 5: closing check

1. `openspec validate --specs --strict`: no new problem compared to the baseline, and the length/Purpose findings in scope are gone.
2. `spec-inventory.mjs diff <snapshot>` for the whole scope: every item it lists is in the decision log.
3. `spec-inventory.mjs refs`: no dangling codes, no reused retired codes, and retired codes still referenced in code have an agreed outcome.
4. If tests reference scenario names, check that they still match.
5. Final status, and the last commit if allowed.

## Follow-up: keeping specs clean (propose, do not apply without approval)

Check that `openspec/config.yaml`, AGENTS.md and CI still guard against what this run found. Propose new rules only for problems that came up in several specs; a one-off finding does not need a rule. If the user provides a file with suggested config changes, read it at this step and use it as a starting point. Before proposing config changes, check that OpenSpec accepts them (e.g. on a scratch copy of `openspec/`). Show a diff and do not overwrite.

## Decision log

Keep it in the scratchpad from the first iteration. One line per decision:

`spec | code | action (rename / split / merge / move to docs / drop / reword) | details | approval (standing or the user's answer)`

It feeds the status updates, the retired-codes list, the per-spec `diff` checks and the closing check. Without it, removals approved early in the run cannot be told apart from accidental losses at the end.

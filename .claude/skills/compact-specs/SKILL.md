---
name: compact-specs
description: Compact and clean up the main OpenSpec specs in openspec/specs/ without changing the behavior contract - shorten inflated Purpose sections, split requirements over 500 characters, rewrite transitional wording, merge duplicates, and move tooling/build/upgrade details out of specs into docs/ while keeping REQ codes traceable. Run only when the user explicitly invokes compact-specs. Do not start it on your own, even if specs look long; suggest it instead.
---

# Compact specs

Compact `openspec/specs/` in this repository: shorter, more readable specs that keep **100% of the behavior contract**. This is a documentation refactor. No system behavior is added, removed or weakened without the user's explicit approval. Tooling and build details that are not behavior move out of the specs into `docs/`.

Specs grow because every `MODIFIED` delta replaces a whole requirement block and agents tend to append to the description instead of adding a new requirement. Transitional wording ("no longer", "after the upgrade") and tooling details leak in along the way. The risk of compacting is silently losing or weakening a constraint, so this workflow is built around an inventory before and a verification after.

## Check the facts first

The OpenSpec facts used below were current as of **OpenSpec 1.14.x (2026-10)**:

- the requirement description limit is 500 characters. Since 1.14.1 it is a WARNING (so `validate --strict` fails); in 1.14.0 and earlier it is only INFO,
- `## Purpose` needs at least 50 characters,
- nested spec folders are supported (since 1.7.0),
- `rules.specs` in `config.yaml` applies when the agent merges specs in `/opsx:sync` and `/opsx:archive`, but the plain CLI `openspec archive` ignores it,
- `skip_specs: true` in a change's `.openspec.yaml` marks a change with no behavior change.

Check them against the installed version (`openspec --version`, its docs and changelog) and tell the user about any that no longer hold before starting.

## Project conventions

- Spec ids are flat `<family>-<topic>`. The families and their meaning are listed in `openspec/config.yaml` (`rules.specs`).
- Requirement headers carry a globally unique traceability code: `### Requirement: REQ-<NNN> Title`. The codes are referenced outside `openspec/`, in app code, tests and SQL migrations.
- Tooling documentation lives in `docs/`: `development.md` for build, test and CI; `e2e-guideline.md`, `coding-standards.md` and `self-hosting.md` for their topics.
- The sources of truth for tooling are `.github/workflows/*.yml`, the root `package.json` (scripts, `devEngines`) and `pnpm-workspace.yaml` (catalog, overrides).

## Ground rules

1. **Meaning over brevity.** Every `SHALL`/`MUST`/`SHOULD`/`MAY` and every scenario still exists afterwards: in a spec (moved, reworded or merged with a duplicate) or, for tooling details, in `docs/`. When something seems worth dropping entirely, put it on a "needs decision" list with a reason instead of deleting it. The user decides what the system no longer promises.
2. **Keep requirement strength.** `MUST` does not become `SHOULD`, "exactly 3 tabs" does not become "3 tabs", and negative constraints ("X does not exist / is not called") stay. Shorter wording often drops exactly these qualifiers, so compare normative sentences carefully.
3. **Keep headers and REQ codes.** `### Requirement: REQ-<NNN> <name>` and `#### Scenario: <name>` stay unchanged unless the plan proposes a rename and the user accepts it. Archive matches deltas by header name, and code and tests reference the REQ codes.
4. **No active changes.** Compaction runs only after all changes are archived, because an active delta written against the old text would conflict with the new one. Run `openspec list`. If any active change has deltas in `openspec/changes/*/specs/`, stop and name them.
5. **Small steps.** One spec (or one pair of specs when merging) at a time, each as a separate, easy-to-review diff. Do not commit without the user's approval.

## REQ codes

- **Split:** the original code stays with the main behavior. Each new requirement gets the next free code (highest code in use + 1). Check every reference to the original code outside `openspec/`. If it points to behavior that moved to a new block, list it for an update.
- **Merge of duplicates:** one code survives, and the other is retired. References to the retired code move to the surviving one.
- **Move to docs:** the code is retired. References in code or tests are either moved to a code that still covers the behavior or removed. Propose which, per reference.
- **Retired codes are never reused.** Keep a short list of retired codes with what happened to each (merged into X, split into Y/Z, moved to `docs/<file>`), and propose where it lives (a section in `docs/` or the commit message). Someone who finds an old code in history or in code needs a way to look it up.
- **Applied SQL migrations are never edited.** If one references a retired code, the retired-codes list is the only place that resolves it.

## Phase 0: baseline (read-only)

1. Check that `git status` is clean and note `openspec --version`.
2. Run `openspec validate --specs --strict --json` and save the result as the baseline. On 1.14.0 or earlier, overlong requirements are only INFO, so count them separately.
3. For every `openspec/specs/*/spec.md`, collect:
   - line count,
   - `## Purpose` length (characters),
   - number of requirements and scenarios,
   - requirements whose description exceeds 500 characters (the description is the text between `### Requirement:` and the first `#### Scenario:`),
   - an **inventory**: `capability → requirement → [scenarios]`, saved to a temporary file outside the repository. The final verification compares against it.
4. Build a **REQ code reference map**: every `REQ-<NNN>` found outside `openspec/` (excluding `node_modules`, build output and `.git`) → the files that reference it. Save it next to the inventory.

## Phase 1: audit and plan (read-only, then stop)

Flag problems in each spec by category:

- **A. Inflated Purpose.** Purpose is 1–3 sentences (≥50 characters) on _why_ the capability exists. Change history, feature lists and details belong in requirements or in the archive.
- **B. Long requirement description (>500 characters).** Propose one of:
  - move examples and edge cases into scenarios,
  - split into several `### Requirement:` blocks, each with one behavior and its own scenarios. The original header and code stay with the main behavior.
- **C. Transitional wording**, i.e. describing the change instead of the state: "no longer", "from now on", "instead of the previous", "as before", "new", "no API changes". Rewrite it to describe how things are, keeping the constraint (rule 2).
- **D. Implementation details**: class/function names, libraries, table schemas, implementation steps. Remove them or move them to `docs/` or code comments. Each case goes on the "needs decision" list, because sometimes it is a real contract (e.g. a public endpoint name).
- **E. Duplication and scattering.** The same behavior in several requirements or specs, or one feature spread across many files. Propose its canonical home.
- **F. Spec too large (>~500 lines) or several unrelated surfaces or contracts in one spec.** Propose a split into separate `<family>-<topic>` specs. A new spec id changes the capability path, so check references in `config.yaml`, AGENTS.md and `docs/`.
- **G. Requirements without a scenario, and scenarios that only restate the requirement.** Flag only. Do not invent behavior.
- **H. Tooling, build and upgrade details.** The default destination is `docs/` (usually `docs/development.md`). To decide per requirement or scenario, ask:
  1. _Does anyone outside the implementation rely on it?_ For example "a pull request cannot be merged unless all quality gates pass", "UI strings come from message catalogs".
  2. _Would the sentence still be true if the tool were replaced?_

  Only if both answers are yes does it **stay as a spec (gray zone)**, rewritten tool-agnostic: no job names, commands, cache keys, image tags, versions or config file details.
  Everything else **moves to `docs/`**: CI job layout, install and cache steps, pinned versions, tool configuration order, Docker image tags, `vp`/`pnpm` commands. Scenarios like "type-check / lint / build / tests pass", "works under <library> vN" or "after the upgrade" were verification steps of past changes, so drop them rather than move them. The docs mention only the gates that still exist.
  Docs do not copy configuration, or they go stale the same way the specs did. They explain which gates exist and why, and point to the source-of-truth files instead of repeating versions and commands.
  Exception: a version that is an **external contract** a consumer would notice stays in the spec. Examples: supported runtime for users, supported browsers, a public API or protocol version, a data/config format version.
  A spec left empty after this is retired: delete its file and note it in the plan. Expect this mostly in the `platform-` family.

Present a **plan** with:

- a table: `spec | lines before | problems (A–H) | proposed actions | estimated lines after | risk`,
- for H, **what moves to which `docs/` file** and **what stays as gray-zone spec** (with the rewritten wording),
- **REQ code changes**: new codes for splits, retired codes, and references outside `openspec/` that need updating,
- a separate **"needs decision"** list.

Then **stop and wait for the user's approval**. The plan is where the user catches a wrong judgment call cheaply. After execution, the same mistake is buried in a large diff.

## Phase 2: execution (after approval, one spec at a time)

Edit the main specs in `openspec/specs/` directly, without creating a change. A delta adds nothing to a refactor with no behavior change, and it fits poorly anyway: a delta cannot change an existing spec's Purpose, `MODIFIED` requires copying whole blocks, and moving a requirement between capabilities means `REMOVED` + `ADDED`.

For each spec:

1. Apply the approved actions.
2. Keep the OpenSpec format: `# <Title>`, `## Purpose`, `## Requirements`, `### Requirement: REQ-<NNN> <name>`, `#### Scenario:` (exactly 4 `#`, or the parser misses it), WHEN/THEN (GIVEN/AND optional), `SHALL`/`MUST` in every requirement. Add no sections other than Purpose and Requirements.
3. Write the moved content into the agreed `docs/` file in the same step. Keep it short and link to the config files.
4. Update the retired-codes list and the agreed REQ references outside `openspec/`. Change only the reference (comment, test name, label), never the logic around it, and never an applied SQL migration.
5. Report briefly: lines before/after, what moved where (spec or docs), what was merged, which codes were added or retired, and what awaits a decision.

## Phase 3: verification

1. `openspec validate --specs --strict`: no new problem compared to the baseline, and the length/Purpose findings are gone.
2. Compare the phase 0 inventory with the new one. Every requirement and scenario from the baseline exists (same name, possibly in another spec) or is on the approved rename/merge/move-to-docs/removal list. Show a table of discrepancies; an empty table means OK.
3. **Semantic check**: per spec, list the normative sentences (`SHALL`/`MUST`/…) before and after and point out which changed wording, with one sentence each on why the meaning is preserved. For content moved to `docs/`, show where each item landed.
4. **REQ codes**: rebuild the reference map. Every code referenced outside `openspec/` exists in a spec or is on the retired list with an agreed outcome. Codes stay unique, and no retired code appears on a new requirement.
5. If tests reference scenario names, check that they still match.

## Follow-up: keeping specs clean (propose, do not implement without approval)

Review `openspec/config.yaml`, AGENTS.md and CI, and propose changes so the problems from phase 1 do not come back. At minimum, check that:

- upgrades, refactors and tooling changes use `skip_specs: true` instead of spec deltas,
- spec rules keep tooling details, library versions and transitional wording out of specs, and keep requirement descriptions at or under 500 characters,
- REQ codes are never changed or reused,
- no spec family or rule invites tooling specs, and no rule states something the installed OpenSpec version contradicts,
- CI runs `openspec validate --specs --strict`,
- AGENTS.md points to `docs/` for tooling details.

If the user provides a file with suggested config changes, read it first and use it as a starting point. Merge suggestions into the existing `config.yaml`, show the diff, and do not overwrite.

## Why

AI-authored changes keep landing low-evidence TypeScript (chained assertions, widen-then-assert, undocumented `as`). Oxlint plus the vendored [anti-slop](https://github.com/dmmulroy/anti-slop) plugin can reject those patterns, but this repo is still ESLint + Prettier only. Oxlint cannot lint Vue templates, so a full ESLint replacement would drop the a11y and i18n gates. Official `@oxlint/migrate` plus leftover ESLint, with Oxfmt for formatting, is the path that is available now.

This is platform tooling, not a WBS product feature. It protects the existing quality gates (`pnpm lint`, `pnpm format:check`) without changing user-facing behavior.

## What Changes

- Generate `.oxlintrc.json` with `pnpx @oxlint/migrate ./eslint.config.mjs --details` (pnpm’s npx). Do **not** pass `--type-aware` or `--with-nursery`. Do **not** add `@oxlint/migrate` as a dependency. Install `oxlint` with `pnpm add -D`.
- Review migrate output: keep ESLint for Vue-template / `vue-eslint-parser` rules (`vue/*` templates, `vuejs-accessibility`, `@intlify/vue-i18n`, leftover `nuxt/*`). Do not rely on Oxlint `jsPlugins` for those even if migrate lists them — they need template parsing Oxlint does not have. Disable overlapping ESLint rules with `eslint-plugin-oxlint`.
- `pnpm lint` becomes `oxlint && eslint .` and is the required CI job. **Fix native Oxlint findings in this change.** Do not install `oxlint-tsgolint`.
- Vendor anti-slop into the generated Oxlint config; enable **every generic rule at `error` inside `pnpm lint`**. Do **not** fix those diagnostics here. A follow-up reviews them. Do not merge until `pnpm lint` is green (follow-up stacked).
- Replace Prettier with Oxfmt (`pnpx oxfmt --migrate=prettier` or `pnpm exec oxfmt --migrate=prettier`). Keep `eslint-config-prettier` last. Do not use `--replace-eslint-comments` globally (would break ESLint-only a11y/i18n disables).
- Update scripts, CI, `AGENTS.md`, and `CODING_STANDARDS.md`. Do not bump `typescript` to 7.

## Capabilities

### New Capabilities

- `lint-and-format-toolchain`: hybrid Oxlint (from `@oxlint/migrate`) + leftover ESLint, Oxfmt instead of Prettier, vendored anti-slop (all generic rules error inside `pnpm lint`).

### Modified Capabilities

- `type-safety`: REQ-159 / REQ-036 stay “explicit `any` is a lint error with a justified disable”; migrate already maps `typescript/no-explicit-any`; disable comments follow the reporting engine.

## Impact

- **Code/tooling:** `package.json` (pnpm), `eslint.config.mjs`, `.oxlintrc.json` from migrate then anti-slop, Oxfmt config, vendored `tools/oxlint/anti-slop/`, CI, docs. Native Oxlint source fixes only (not anti-slop).
- **APIs / schema / i18n catalogs:** unchanged except incidental Oxfmt reflow.
- **Tests:** existing lint/format CI jobs.

## Non-goals

- Type-aware Oxlint, `--with-nursery`, or replacing `nuxt typecheck` / `vue-tsc`.
- TypeScript 7; dropping ESLint for Vue templates, a11y, or vue-i18n.
- Fixing anti-slop findings (separate proposal; must land before or with this change so `pnpm lint` is green).
- Anti-slop Effect rules; adding `@oxlint/migrate` as a package dependency.
- Product, API, or schema behavior changes.

## 1. Official Oxlint migrate (pnpm / pnpx)

- [x] 1.1 `pnpm add -D oxlint eslint-plugin-oxlint` and verify they are in `package.json` / the lockfile and `@oxlint/migrate` is **not** a dependency
- [x] 1.2 Run `pnpx @oxlint/migrate ./eslint.config.mjs --details` with **no** `--type-aware` and **no** `--with-nursery`; commit the generated `.oxlintrc.json`; delete `.oxlintrc.json.bak` if present; verify `$schema` is set and `categories.correctness` is `off` as migrate emitted
- [x] 1.3 Review `--details` skipped rules (Vue template / nursery / unimplemented); remove `eslint-plugin-vuejs-accessibility`, `@intlify/eslint-plugin-vue-i18n`, and `@nuxt/eslint-plugin` from Oxlint `jsPlugins` unless a documented spike proves template coverage; verify those plugins remain on ESLint
- [x] 1.4 Add `ignorePatterns` for `.nuxt`, `.output`, `node_modules`, `dist`, `server/db/migrations`, and `tools/oxlint/anti-slop/**`; verify Oxlint does not lint those trees
- [x] 1.5 Set `lint` to `oxlint && eslint .` and `lint:fix` to `oxlint --fix && eslint . --fix`; verify `pnpm lint` runs Oxlint first (even if it then fails)
- [x] 1.6 Append `eslint-plugin-oxlint` `buildFromOxlintConfigFile` **before** `eslint-config-prettier`; do **not** pass `--replace-eslint-comments` to migrate; verify overlapping ESLint rules are off and a11y/i18n disables still use ESLint comment syntax

## 2. Vendor anti-slop into `pnpm lint`

- [x] 2.1 Copy anti-slop `src/` to `tools/oxlint/anti-slop/` (generic plugin only) and verify the tree exists and is ignored by Oxlint/Oxfmt
- [x] 2.2 Register it in `.oxlintrc.json` `jsPlugins` and set **every generic** `anti-slop/*` rule to `error`; do not register `anti-slop-effect`; verify `pnpm lint` emits `anti-slop/` diagnostics
- [x] 2.3 Snapshot current `anti-slop/` findings for the follow-up; **do not** edit application code to satisfy anti-slop in this change

## 3. Frontend — native Oxlint fixes (not anti-slop)

- [x] 3.1 Fix native Oxlint findings under `app/` and convert `no-explicit-any` disables only where ESLint’s copy is disabled; verify remaining `pnpm lint` failures under `app/` are only `anti-slop/` (or none)
- [x] 3.2 Fix native Oxlint findings under `test/nuxt/` the same way; verify remaining failures there are only `anti-slop/` (or none)

## 4. Backend — native Oxlint fixes (not anti-slop)

- [x] 4.1 Fix native Oxlint findings under `server/` and `shared/`; convert `no-explicit-any` disables as in 3.1; verify remaining failures in those trees are only `anti-slop/` (or none)
- [x] 4.2 Fix native Oxlint findings under `test/unit/` and `test/e2e/`; verify remaining failures there are only `anti-slop/` (or none)

## 5. Oxfmt migration

- [x] 5.1 `pnpm add -D oxfmt` then `pnpx oxfmt --migrate=prettier` (or `pnpm exec oxfmt --migrate=prettier`); preserve `semi`, `singleQuote`, `printWidth: 100`, `trailingComma`, `htmlWhitespaceSensitivity: ignore`; verify the Oxfmt config contains those options
- [x] 5.2 Point `format` / `format:check` at Oxfmt (`pnpm exec oxfmt` / `--check`); remove the `prettier` package if unused; keep `eslint-config-prettier`; verify scripts do not call the `prettier` CLI
- [x] 5.3 Run Oxfmt write once and commit reflow separately if needed; verify `pnpm format:check` exits zero including `.vue` files

## 6. Docs

- [x] 6.1 Update `AGENTS.md` and `CODING_STANDARDS.md` for Oxlint (from migrate) + leftover ESLint, Oxfmt, anti-slop inside `pnpm lint`, and `no-explicit-any` disable syntax; document `pnpm` / `pnpx` not npm / npx; verify they no longer treat Prettier as the formatter or ESLint as the sole linter

## 7. Verification

- [x] 7.1 Run `pnpm format:check` and `pnpm type-check` and verify both pass
- [x] 7.2 Run `pnpm lint` and verify: (a) Oxlint then ESLint, (b) no native Oxlint errors remain, (c) remaining errors are only `anti-slop/`, (d) ESLint still loads a11y and vue-i18n
- [x] 7.3 Run `pnpm test:unit` and `pnpm test:nuxt` and verify they pass after native-lint source edits
- [x] 7.4 Confirm `oxlint-tsgolint` and `@oxlint/migrate` are not dependencies and `--type-aware` is not in scripts or Oxlint config
- [x] 7.5 Do **not** merge until a follow-up anti-slop review makes `pnpm lint` fully green; verify that follow-up is identified before opening the PR

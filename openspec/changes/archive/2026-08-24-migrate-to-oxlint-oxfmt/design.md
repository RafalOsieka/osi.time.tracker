## Context

See `proposal.md` for motivation. Today `pnpm lint` is `eslint .` via `withNuxt()` (`eslint.config.mjs`) and `pnpm format` is Prettier (`.prettierrc.json`). Official migration is [`@oxlint/migrate`](https://github.com/oxc-project/oxlint-migrate). A dry-run (`pnpx @oxlint/migrate ./eslint.config.mjs --details`) produced 166 rules, skipped 75 (mostly Vue template parsing), warned about `vue-eslint-parser`, and listed a11y / vue-i18n / `@nuxt/eslint-plugin` under `jsPlugins` even though those plugins need templates. Specs: `specs/lint-and-format-toolchain/spec.md`, `specs/type-safety/spec.md`.

```
pnpx @oxlint/migrate ./eslint.config.mjs --details
        │  (no --type-aware, no --with-nursery)
        ▼
.oxlintrc.json  ──review──► strip template jsPlugins
        │                   add anti-slop jsPlugin
        ▼
pnpm lint = oxlint && eslint .
                 eslint-plugin-oxlint then eslint-config-prettier last

pnpm format / format:check  →  oxfmt
```

All one-off CLIs use **`pnpx`** (pnpm’s `npx` / `pnpm dlx`). Installs use **`pnpm add -D`**. Do not add `@oxlint/migrate` to `package.json`.

## Goals / Non-Goals

**Goals:**

- Oxlint config from `@oxlint/migrate`, then reviewed; `pnpm lint` is `oxlint && eslint .`.
- Native Oxlint findings fixed here; anti-slop findings left for a follow-up (merge waits on green `pnpm lint`).
- Oxfmt replaces Prettier.

**Non-Goals:**

- `--type-aware`, `--with-nursery`, TypeScript 7, dropping `@nuxt/eslint`, or treating migrate’s template `jsPlugins` as sufficient coverage.

## Decisions

### D1 — `@oxlint/migrate` is the Oxlint config source

Run `pnpx @oxlint/migrate ./eslint.config.mjs --details` (explicit config path). Commit `.oxlintrc.json` (`$schema` included). Delete `.oxlintrc.json.bak` if created. Do not pass `--type-aware` or `--with-nursery`. Leave `categories.correctness: "off"` as migrate emits it (avoids extra rules ESLint did not enable). If `plugins` overrides defaults, keep migrate’s override plugins plus any `overrides[].plugins` it already set (e.g. `typescript`).

- **Why:** Official skill path; matches the current ESLint rule set instead of hand-authoring.
- **Alternative:** Hand-written `oxlint.config.ts`. Rejected: drifts from ESLint and skips 166 mapped rules.

### D2 — Hybrid leftover ESLint; strip template `jsPlugins`

Keep `@nuxt/eslint` + a11y + vue-i18n on ESLint. After migrate, **remove** `eslint-plugin-vuejs-accessibility`, `@intlify/eslint-plugin-vue-i18n`, and `@nuxt/eslint-plugin` from Oxlint `jsPlugins` unless a spike proves they fire on Vue templates. `--details` already says most `vue/*` rules need template parsing.

- **Why:** False-positive jsPlugin migration would drop template gates if ESLint were thinned too far.
- **Alternative:** Trust migrate `jsPlugins` and drop ESLint for those plugins. Rejected: Vue template AST is unsupported.
- **Alternative:** `--js-plugins false`. Rejected: some non-template JS plugins may still be useful; we strip only parser-dependent ones.

### D3 — `eslint-plugin-oxlint` last-but-prettier

`pnpm add -D oxlint eslint-plugin-oxlint`. Append `buildFromOxlintConfigFile` **before** `eslint-config-prettier`. Do **not** run `--replace-eslint-comments` globally (would rewrite a11y/i18n disables). Convert `no-explicit-any` comments only if ESLint’s copy is turned off (migrate already maps `typescript/no-explicit-any`). Oxlint still honors `// eslint-disable`.

- **Alternative:** Hand-maintained ESLint `off` list. Rejected: drifts.
- **Alternative:** `--replace-eslint-comments`. Rejected: leftover ESLint rules still need ESLint disable syntax.

### D4 — Anti-slop vendored, all generic rules `error` on the same `pnpm lint`

Copy anti-slop `src/` to `tools/oxlint/anti-slop/`, add to `jsPlugins` after migrate, every generic rule `error`. Ignore the plugin tree. No Effect plugin. Do not fix/suppress/waive those hits here. Snapshot `pnpm lint` for the follow-up. Merge only when stacked follow-up makes lint green.

- **Alternative:** Separate `lint:anti-slop`. Rejected: anti-slop must be inside `pnpm lint`.

### D5 — Oxfmt replaces Prettier

`pnpm add -D oxfmt` then `pnpx oxfmt --migrate=prettier` (or `pnpm exec oxfmt --migrate=prettier`). Drop `prettier`; keep `eslint-config-prettier`. Skill recommends Oxfmt over `eslint-plugin-prettier` (we do not use that plugin today).

- **Alternative:** Keep Prettier. Rejected: Vue is a supported Oxfmt language (bundled Prettier for templates).

### D6 — No type-aware Oxlint; keep `typescript@6` + `vue-tsc`

Do not pass migrate `--type-aware`; do not `pnpm add oxlint-tsgolint`.

- **Alternative:** Type-aware on `.ts` only. Rejected: deferred.

## Risks / Trade-offs

- [Migrate `jsPlugins` look complete but miss templates] → D2: keep ESLint for those plugins; verify with `--details`.
- [714 globals / `vue-eslint-parser` warning] → Review generated `globals`; do not invent a second parser.
- [Explicit `plugins: [import, unicorn]` disables default `typescript`/`oxc` at root] → Keep migrate `overrides` that re-enable `typescript`; add `vue` only if script-tag rules are wanted without extra native findings.
- [Anti-slop JS plugins alpha] → Follow-up bumps the vendored copy.
- [CI `lint` red until anti-slop follow-up] → Expected. Do not merge this change alone.

## Migration Plan

1. `pnpm add -D oxlint eslint-plugin-oxlint oxfmt`
2. `pnpx @oxlint/migrate ./eslint.config.mjs --details` → review → strip template jsPlugins → add anti-slop → `ignorePatterns`
3. Scripts: `oxlint && eslint .` / `oxlint --fix && eslint . --fix`; Oxfmt for format
4. Fix native Oxlint; leave anti-slop; format; docs
5. Remove `.oxlintrc.json.bak`; rollback = revert commits
6. Merge after anti-slop follow-up is green

## Open Questions

None blocking. Implementation may keep `@nuxt/eslint-plugin` on Oxlint only if a spike shows script/config rules firing without losing ESLint `nuxt/*` coverage.

# Tasks

Documentation-only change: no frontend or backend work, and no code tests. Each task is checked against the repository state or `openspec validate`.

## 1. Re-verify the facts the deltas assert

- [x] 1.1 Confirm the catalog, overrides and Docker tag agree:
  - `vite-plus` catalog version == the `ghcr.io/voidzero-dev/vite-plus:<tag>` in every Dockerfile stage;
  - `pnpm-lock.yaml` resolves `vite@*` to `@voidzero-dev/vite-plus-core`;
  - `@vitest/coverage-v8` == `vitest` in the catalog.

  If anything drifted since this proposal, update the delta wording, not the code.
- [x] 1.2 Confirm `.oxlintrc.json`, `.oxfmtrc.json` and the root `vitest.config.ts` are absent, `.gitattributes` has `* text=auto eol=lf`, and `vite.config.ts` `lint.jsPlugins` lists `anti-slop` and `vite-plus/oxlint-plugin`. Verify with `git ls-files` and grep.
- [x] 1.3 Confirm every CI job uses `voidzero-dev/setup-vp` with `cache: true` and `vp install --frozen-lockfile` (filtered installs included), no job uses `vp check` as a gate, and `.github/dependabot.yml` lists `npm`, `github-actions` and `docker`. Verify by grepping `.github/`.

## 2. Update main-spec Purpose lines and project context

- [x] 2.1 Edit `openspec/specs/platform-toolchain/spec.md` Purpose to name Vite+ (`vp`) as the toolchain the workspace workflows run on. Verify that `openspec show platform-toolchain --type spec --json --no-scenarios` shows the new purpose.
- [x] 2.2 Edit `openspec/specs/platform-lint-format/spec.md` Purpose to say Oxlint and Oxfmt run through Vite+ (`vp lint` / `vp fmt`) and are configured in the root `vite.config.ts`. Verify the same way.
- [x] 2.3 Update the `context` block of `openspec/config.yaml`:
  - change the Node.js line from `≥25.0.0` to the `devEngines` range (`^24.21.0`);
  - add Vite+ (`vp`) next to pnpm.

  Verify that `openspec instructions proposal --change sync-specs-vite-plus --json` echoes the new context.

## 3. Validate and sync

- [x] 3.1 Run `openspec validate sync-specs-vite-plus --strict` and fix any delta format issues until it passes.
- [x] 3.2 Check that REQ-370 is unused anywhere else: `grep -r "REQ-370" openspec/` must show only this change.
- [x] 3.3 Archive the change (`/openspec-archive-change`). Verify that the four main specs contain the MODIFIED/ADDED text, and that `openspec list --specs` requirement counts are +1 for `platform-toolchain` and unchanged elsewhere.

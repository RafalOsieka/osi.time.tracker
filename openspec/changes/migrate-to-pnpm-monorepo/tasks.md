## 1. Workspace and tracker package

- [ ] 1.1 Add private workspace manifests and standalone tracker TypeScript/Vitest configuration with explicit exports and declared dependencies; verify a filtered frozen install and package build without Nuxt preparation (REQ-305).
- [ ] 1.2 Extract neutral contracts and required utilities, separating remote DTOs from web finalization/proxy/persistence types; verify package type-check and contract type tests.
- [ ] 1.3 Move OpenProject implementation and its focused tests, replacing the Node-only auth fallback; verify provider tests and authentication header parity without `Buffer`.
- [ ] 1.4 Move Redmine implementation and its focused tests; verify provider tests against package exports, including failure mapping and pagination.
- [ ] 1.5 Verify emitted exports in a Node consumer and browser bundle, and rejection of private deep imports; add focused package-boundary checks that run without `.nuxt`.

## 2. Web frontend relocation

- [ ] 2.1 Move Nuxt app, public assets, catalogs, web configuration, and web-owned shared types into `apps/web`, separating dependency ownership from the root; verify Nuxt preparation resolves the relocated app and catalogs.
- [ ] 2.2 Rewire frontend factories, transports, composables, and type imports to public package exports; run the relocated adapter-factory and remote composable unit tests.
- [ ] 2.3 Relocate frontend unit/component/UI tests and fix their aliases/fixture paths; verify test discovery parity and run component tests plus existing tracker/link/sync UI journeys without weakening assertions.

## 3. Web backend relocation

- [ ] 3.1 Move server code, Drizzle configuration, and unchanged SQL migration history into `apps/web`; rewire server provider imports and root environment resolution; verify server type-check and byte-for-byte preservation of migration SQL.
- [ ] 3.2 Relocate backend unit and database integration tests; run server-adapter unit tests and database/migrator suites to verify task 3.1.
- [ ] 3.3 Rewire API E2E harness roots, isolated server builds, and output reuse for the new web directory; run existing API happy/error tests for tracker management and remote proxy endpoints to verify relocation without contract changes.

## 4. Repository workflows and deployment

- [ ] 4.1 Add ordered root build/type-check and web command forwarding, package watch plus web dev lifecycle, and explicit root `.env` handling; verify package failure propagates and dev reflects a shared-code edit without restarting manually.
- [ ] 4.2 Adapt lint, format, generated-file ignores, and root anti-slop test discovery without editing plugin rules; verify `pnpm lint`, `pnpm format:check`, and tooling unit tests.
- [ ] 4.3 Update Docker manifest installation, web output copying, and root migration forwarding while retaining Compose volume/service behavior; verify image build and migrator/start ordering in an isolated test project only.
- [ ] 4.4 Update CI build artifacts, E2E reuse, source coverage paths, and independent package gate; verify workflow paths and coverage inputs include package, web, and tooling suites without Nuxt requirements in the package gate.
- [ ] 4.5 Update README, agent/style path guidance, and E2E/deployment docs for new source/output paths and unchanged root commands; verify all documented commands resolve to the intended workspace.

## 5. Cross-workspace acceptance

- [ ] 5.1 Run standalone package build/type-check/tests without generated Nuxt context, followed by root lint, format, type-check, unit, and Nuxt suites; record REQ-305/306 evidence and any actual environment blockers.
- [ ] 5.2 Run production build and all existing E2E projects with isolated database/browser resources; confirm client/server results, credential handling, migration history, and API behavior are unchanged before the extension change starts.
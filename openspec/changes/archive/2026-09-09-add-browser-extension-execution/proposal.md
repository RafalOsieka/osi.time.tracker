## Why

A hosted OSI installation cannot reach VPN-only trackers, while ordinary browser requests fail when tracker CORS is unavailable. A Chrome/Edge extension lets on-demand tracker operations use the user's PC network without hosting OSI locally or changing tracker configuration.

## What Changes

- Add a private `apps/extension` Chromium Manifest V3 application reusing `@osi/remote-trackers`.
- Add `packages/extension-protocol` with independently built, versioned, validated operation messages shared by web and extension.
- Implement an approved-site content bridge, background operation dispatcher, guarded transport, and website/tracker permission management.
- Add `extension` execution selection, an app-side adapter, setup guidance, compatibility/availability feedback, and safe create-timeout handling.
- Preserve browser-held credentials; forward them transiently through the extension, never through OSI APIs for extension execution.
- Test the real browser/worker path against local fake trackers without CORS and document unpacked Chrome/Edge installation.

## Capabilities

### New Capabilities

- `browser-extension-execution`: installation, approvals, operation bridge, compatibility, network confinement, and lifecycle safety.

### Modified Capabilities

- `remote-adapter-contract`: third-mode equivalence and credential/error handling across all three execution paths.
- `tracker-management`: accept/select extension mode and retain browser-only secret ownership.

## Non-goals

No mobile no-trackers policy, PWA/offline implementation, native companion, server relay, background synchronization, extension-only credential vault, store publication, public domain, or separate proof-of-concept phase. No tracker CORS changes or workplace network bypasses.

## Impact

The monorepo prerequisite is implemented and archived as `2026-09-07-migrate-to-pnpm-monorepo`. The landed baseline is `@osi/time-tracker` in `apps/web` and `@osi/remote-trackers` in `packages/remote-trackers`, exposing `/contracts`, `/openproject`, and `/redmine`; extension implementation must consume these public exports.

Touches tracker validation/UI, remote adapter selection and export error handling, extension build/test tooling, and CI. Existing OSI tracker APIs accept the new mode; server execution must not become a fallback. Plain-text database mode storage needs no schema migration. The user explicitly prioritizes this MVP connectivity extension to WBS 5.1–5.3 and 5.14–5.15; older client-only user-story wording is superseded by active client/server specs and this approved addition. Ordinary local time tracking remains usable when the extension is unavailable.

Repository wiring includes protocol dependency build/watch ordering for both consumers and web test entry points, Docker manifest installation and web dependency builds, and independent protocol/extension quality gates without Nuxt preparation. Extension packaging remains separate from the production web image.
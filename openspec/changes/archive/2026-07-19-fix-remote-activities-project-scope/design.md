# Design: fix-remote-activities-project-scope

## Context

The Remote Sync page (`app/pages/sync/[date].vue`) offers a per-row **activity** select for manageable OpenProject rows. Options flow through `useRemoteActivities(config)` → `buildTimeEntryActivitiesRequest` / `parseTimeEntryActivitiesResults` in `shared/utils/openproject-adapter.ts`, executed either browser-direct or via the `POST /api/remote/activities` proxy (`proxyOpenProjectActivities`). Today the request targets the **global** time-entries schema (`GET /api/v3/time_entries/schema`), and the parser reads `activity._embedded.allowedValues`.

The picker is always empty because the global schema has no project context: its `activity` field is a bare descriptor (`activity._links: {}`) with no `_embedded.allowedValues`. OpenProject enables/disables time-entry activities **per project**, so allowed values only appear on a project-scoped schema. Each sync row already carries `issueRef.remoteIssueId`, giving us the linked work package to scope by.

## Goals / Non-Goals

**Goals:**

- Populate the activity picker with **project-correct** options for each manageable OpenProject row.
- Keep the change minimal: only the adapter enablement strictly required (POST + body) plus per-project fetch/dedup.

**Non-Goals:**

- No empty-state permissions hint (deferred); an empty list stays silent.
- No broader adapter-interface redesign (post-MVP).
- No change to push behavior; the page stays review-only.

## Decisions

### D1: Endpoint — project-scoped `POST /api/v3/time_entries/form`

| Endpoint | Project-scoped? | Payload shape | Verdict |
|---|---|---|---|
| `GET /time_entries/schema` (current) | ❌ no project context | `activity._links: {}` (empty) | broken — today's bug |
| `GET /time_entries/activities` | ❌ system-wide list | HAL collection `_embedded.elements` | wrong scope **and** wrong shape — offers activities the target project rejects |
| `POST /time_entries/form` (+ work package) | ✅ yes | `_embedded.schema.activity._embedded.allowedValues` | **chosen** — project-accurate and matches the parser's leaf `{ id, name }` shape |

The form endpoint is a validation call: OpenProject returns a project-scoped schema whose `activity` embeds the allowed values. It is the only option that is both project-correct and shape-compatible with the existing parser leaf.

### D2: Project resolution via the `workPackage` link (no extra lookup)

POST the form with the row's work-package link and let OpenProject derive the project:

```jsonc
POST /api/v3/time_entries/form
{ "_links": { "workPackage": { "href": "/api/v3/work_packages/{remoteIssueId}" } } }
```

- *Alternative considered:* a two-hop flow — `GET /work_packages/{id}` → read `_links.project.href` → post the form with the project link. Rejected: an extra round-trip per row for no benefit, since the form already derives the project from the work package. We already hold `remoteIssueId`, so we build the work-package href directly from `baseUrl`.

### D3: Minimal `AdapterRequest` enablement (POST + body)

`AdapterRequest` today is GET-only with no body. The form call needs a POST with a JSON body, so:

```ts
interface AdapterRequest {
  url: string;
  method: 'GET' | 'POST';
  body?: unknown; // JSON body for POST/form endpoints
}
```

`buildTimeEntryActivitiesRequest` changes signature from `(baseUrl)` to `(baseUrl, workPackageRef)` and emits the form POST. The proxied transport (`proxyOpenProjectActivities` + `POST /api/remote/activities`) forwards `method`/`body`; the proxied request body schema in `shared/types` gains the work-package reference. This is the **only** interface change — the broader multi-adapter redesign stays deferred.

### D4: Parser reads the deeper form nesting

`parseTimeEntryActivitiesResults` reads `_embedded.schema.activity._embedded.allowedValues` (one level deeper than the current `activity._embedded.allowedValues`). The leaf shape is unchanged, so each option still maps to an adapter-neutral `{ id, name }`; malformed/absent payloads still yield `[]`.

### D5: Per-project/work-package fetch with dedup

Fetch granularity moves from **once per remote configuration** to **once per resolved project/work package**. `useRemoteActivities` memoizes by the resolved key (work-package/project) so rows sharing a project trigger a single fetch:

```
per-config cache (today)        per-project cache (chosen)
config ──▶ [activities]         projectKey ──▶ [activities]
                                (rows dedupe on their resolved project)
```

## Risks / Trade-offs

- [Empty result may still be a permissions issue] → an API key lacking "log time"/"view time entries" returns the same empty list. Same symptom, different cause; surfacing a hint is deferred (Non-goal).
- [Extra requests when a day spans many projects] → bounded by dedup: one fetch per distinct resolved project, not per row.
- [Form POST auth/CSRF] → confirm the form POST needs no CSRF or headers beyond the existing API-key Basic auth we already send on GET calls; the proxy path already attaches credentials server-side.

## Open Questions

- None blocking. Live-instance verification of the form POST's auth requirements happens during implementation of the tasks.

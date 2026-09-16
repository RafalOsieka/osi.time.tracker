## MODIFIED Requirements

### Requirement: REQ-133 List own tasks
The system SHALL show the authenticated user only their own tasks via `GET /api/tasks`, ranked **most recently used first**: tasks SHALL be ordered by the greatest `startedAt` among their time entries descending, tasks with no entries SHALL come after every task that has one, and ties SHALL be broken by `name` ascending. The list SHALL exclude any task belonging to another user. Each returned task SHALL include its `uuidv7` `id`.

The endpoint SHALL accept an optional `limit` query parameter (positive integer) that caps the number of returned tasks. When `limit` is omitted the system SHALL apply a default cap of `20`; the system SHALL reject a `limit` that is not a positive integer or exceeds `100` with HTTP 422 and the `{ messageKey, params }` contract. The response SHALL never contain more tasks than the effective cap, and the cap SHALL apply after ranking so the returned tasks are the highest-ranked matches.

The endpoint SHALL accept an optional `projectId` query parameter that further restricts results to that project, always additionally scoped by `userId`; a dedicated sentinel value (`projectId=none`) SHALL restrict results to project-less tasks (`projectId IS NULL`). The endpoint SHALL additionally accept an optional `search` query parameter that restricts results to tasks whose `name` contains the value case-insensitively, to power title autocomplete; an empty or whitespace-only `search` SHALL be treated as absent. Each returned task SHALL include the owning project's name (`projectName`) and the owning client's name (`clientName`) resolved via LEFT joins that do NOT filter on the project's or client's `deletedAt`, so the names are present even when a parent has been soft-deleted; for a project-less task both `projectId`, `projectName`, and `clientName` SHALL be `null`.

#### Scenario: User sees only their own tasks
- **WHEN** an authenticated user requests their tasks
- **THEN** the response SHALL contain only tasks where `userId` equals the user's id

#### Scenario: Most recently used task ranks first
- **WHEN** an authenticated user has task A whose newest entry started yesterday and task B whose newest entry started today, and A sorts before B by name
- **THEN** the response SHALL list B before A

#### Scenario: Tasks without entries rank last, then by name
- **WHEN** an authenticated user has tasks with entries and tasks that have never had an entry
- **THEN** every task with an entry SHALL precede every task without one, and tasks without entries SHALL be ordered by `name`

#### Scenario: Default cap applies
- **WHEN** an authenticated user with more than 20 matching tasks requests their tasks without a `limit`
- **THEN** the response SHALL contain exactly 20 tasks and they SHALL be the 20 highest-ranked matches

#### Scenario: Explicit limit applies
- **WHEN** an authenticated user requests their tasks with `limit=5`
- **THEN** the response SHALL contain at most 5 tasks

#### Scenario: Limit is validated
- **WHEN** an authenticated user requests their tasks with `limit=0`, `limit=abc`, or `limit=101`
- **THEN** the system SHALL respond with HTTP 422 and a `messageKey` describing the invalid limit, and SHALL NOT return any tasks

#### Scenario: Response includes the project and client names
- **WHEN** an authenticated user lists their tasks
- **THEN** each returned task SHALL include a `projectName` field and a `clientName` field naming its owning project and client

#### Scenario: Names persist after a parent is soft-deleted
- **WHEN** a task's owning project (or its client) has been soft-deleted
- **THEN** the task SHALL still appear in the list with its `projectName` and `clientName` populated from the soft-deleted parent

#### Scenario: Filter by project
- **WHEN** an authenticated user requests their tasks with a `projectId` filter for a project they own
- **THEN** the response SHALL contain only their tasks belonging to that project

#### Scenario: Filter by a foreign or unknown project
- **WHEN** an authenticated user requests tasks with a `projectId` that is unknown or owned by another user
- **THEN** the system SHALL return an empty list and SHALL NOT reveal whether that project exists

#### Scenario: Search by name
- **WHEN** an authenticated user requests their tasks with a `search` value
- **THEN** the response SHALL contain only their tasks whose `name` contains that value case-insensitively, with project/client context, ranked most recently used first and capped

#### Scenario: Blank search is ignored
- **WHEN** an authenticated user requests their tasks with `search=` or a whitespace-only value
- **THEN** the response SHALL be the same as a request without `search`

#### Scenario: List includes project-less tasks
- **WHEN** an authenticated user has a task with no project and requests their tasks without a filter
- **THEN** the response SHALL include that task with `projectId`, `projectName`, and `clientName` all `null`

#### Scenario: Filter to project-less tasks
- **WHEN** an authenticated user requests their tasks with the sentinel `projectId=none`
- **THEN** the response SHALL contain only their tasks that have no project

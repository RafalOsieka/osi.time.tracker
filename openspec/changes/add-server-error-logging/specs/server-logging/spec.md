## Purpose

Define what the server writes to its standard output so that a self-hoster can investigate failing API requests and database problems from container logs, at a verbosity they control at runtime, without ever leaking secrets into those logs.

## ADDED Requirements

### Requirement: REQ-355 Every request error is logged
The server SHALL write one log line to standard output for every request that ends in an error response, regardless of whether the error was raised by application code, by platform middleware, or was an unhandled exception. The line SHALL include the HTTP method, the request path (without query string), the response status code and, when the error carries the `{ messageKey, params }` contract (REQ-171), the `messageKey`. Errors with a 4xx status SHALL be logged at `warn` level; errors with a 5xx status and unhandled exceptions SHALL be logged at `error` level together with the error message, stack trace and, when present, the underlying `cause`. Successful requests SHALL NOT produce a log line.

#### Scenario: Middleware rejection is visible
- **WHEN** platform middleware rejects a request with HTTP 400 before any route handler runs
- **THEN** standard output SHALL contain a `warn` line naming the method, path and status `400`

#### Scenario: Validation failure names the message key
- **WHEN** a route rejects a body with HTTP 422 and `{ messageKey: 'error.remoteLogImportProjectNotBound' }`
- **THEN** standard output SHALL contain a `warn` line naming the method, path, status `422` and `error.remoteLogImportProjectNotBound`

#### Scenario: Database failure carries the stack
- **WHEN** a route throws because the database connection fails
- **THEN** standard output SHALL contain an `error` line naming the method and path, followed by the driver error message and stack trace

#### Scenario: Unhandled exception is logged once
- **WHEN** a route throws a non-HTTP exception
- **THEN** the failure SHALL appear in standard output exactly once, not duplicated by both the platform default output and the application error log

#### Scenario: Successful request is silent
- **WHEN** a request completes with a 2xx or 3xx status
- **THEN** no request log line SHALL be written at the default level

### Requirement: REQ-356 Secrets never reach the logs
Request error log lines SHALL NOT include the request body, query string values, request headers, cookies, or the session contents. Application log calls SHALL NOT log credentials, session secrets, tracker API keys, or full `DATABASE_URL` values at any level, including `debug` and `trace`.

#### Scenario: Failed tracker creation does not expose the key
- **WHEN** `POST /api/trackers` fails validation with a body containing an `apiKey`
- **THEN** the resulting log line SHALL contain the method, path, status and `messageKey` but SHALL NOT contain the `apiKey` value

#### Scenario: Failed login does not expose the password
- **WHEN** `POST /api/auth/login` responds with HTTP 401
- **THEN** the resulting log line SHALL NOT contain the submitted email or password

#### Scenario: Query logging at debug omits connection secrets
- **WHEN** the log level is `debug` and a database query is executed
- **THEN** the logged statement and parameters SHALL NOT include the database password or connection string

### Requirement: REQ-357 Runtime-configurable log level
The server SHALL read its log level from the `CONSOLA_LEVEL` environment variable at startup, defaulting to `info` when unset. Levels are ordered `error` < `warn` < `info` < `debug` < `trace`; a line SHALL be written only when its level is at or below the configured level. At `debug` and above the server SHALL additionally log every executed database statement with its parameters. Application code MAY emit `info`, `debug` and `trace` lines describing progress of long-running operations (such as a remote-log import summary) and these SHALL follow the same level filtering. Changing the level SHALL NOT require rebuilding the image.

#### Scenario: Default level hides debug output
- **WHEN** the server starts without `CONSOLA_LEVEL`
- **THEN** `warn` and `error` request lines are written and `debug` lines (including database statements) are not

#### Scenario: Debug level shows database statements
- **WHEN** the server starts with `CONSOLA_LEVEL` set to the `debug` level and a route runs a query
- **THEN** standard output SHALL contain the executed statement and its parameters

#### Scenario: Invalid level value falls back
- **WHEN** `CONSOLA_LEVEL` is set to a value that is not a recognised level
- **THEN** the server SHALL start and behave as if the level were `info`

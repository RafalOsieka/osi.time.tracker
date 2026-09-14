## ADDED Requirements

### Requirement: REQ-354 Optional runtime log level variable
The production compose stack SHALL pass an optional `CONSOLA_LEVEL` environment variable to the application container, defaulting to the `info` level when unset, so the server's log verbosity (server-logging REQ-357) can be raised for troubleshooting without rebuilding the image. `.env.example` SHALL document the variable, its accepted values and the default in the production section (REQ-346). The variable SHALL be optional: the stack SHALL start without it.

#### Scenario: Stack starts without the variable
- **WHEN** the production stack is started with `.env` not defining `CONSOLA_LEVEL`
- **THEN** the application starts and logs at the `info` level

#### Scenario: Raising verbosity without a rebuild
- **WHEN** a self-hoster sets `CONSOLA_LEVEL` to the `debug` level in `.env` and restarts only the `app` service
- **THEN** the container logs include debug output (including database statements) without the image being rebuilt

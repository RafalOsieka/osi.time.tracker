## ADDED Requirements

### Requirement: Aspire-managed Vite Dev Server
The .NET Aspire `AppHost` MUST orchestrate the Vite development server for the `Web` project.

#### Scenario: Running the application in Dev
- **WHEN** the `AppHost` is started in development mode
- **THEN** it launches the `pnpm dev` command for the `Web` project

### Requirement: Automatic API Proxying
The Vite development server MUST automatically proxy requests starting with `/api` to the active .NET API instance managed by Aspire.

#### Scenario: Fetching data from API
- **WHEN** the frontend makes a request to `/api/weatherforecast` during development
- **THEN** Vite proxies the request to the correct API endpoint (e.g., `localhost:5001`) and returns the response

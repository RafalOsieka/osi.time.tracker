## ADDED Requirements

### Requirement: Unified Production Docker Image
The system MUST provide a single Docker image containing both the compiled .NET API and the built Vue.js frontend assets.

#### Scenario: Running the production container
- **WHEN** the Docker container is launched
- **THEN** it serves the Vue.js frontend as static files on the root path and provides API endpoints under `/api`

### Requirement: Multi-stage Build with `pnpm`
The `Dockerfile` MUST use a multi-stage approach and employ `pnpm` for building the frontend assets to ensure speed and reproducibility.

#### Scenario: Building the container
- **WHEN** the `docker build` command is executed
- **THEN** the first stage uses a Node.js image with `pnpm` to build the frontend, and the results are copied into the final .NET runtime image

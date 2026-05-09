## Why

The current development workflow lacks a seamless integration between the .NET Aspire orchestrator and the Vue.js frontend, requiring manual builds of the frontend to see changes in the API's `wwwroot`. This slows down developer velocity by missing out on Vite's Hot Module Replacement (HMR). Additionally, the production hosting model needs to be formalized as an integrated, multi-stage Docker build to ensure consistent deployments with `pnpm`.

## What Changes

- **Solution Integration**: Add an `.esproj` file for the `src/Web` directory and include it in the `osi.time.tracker.slnx` solution for better IDE visibility and DX.
- **Development Orchestration**: Configure .NET Aspire to manage the Vite development server using `AddNpmApp` with `pnpm`, enabling HMR and automatic proxying.
- **Production Hosting**: Create a multi-stage `Dockerfile` for the API project that builds the Vue frontend using `pnpm` and serves it as static files from `wwwroot`.
- **Frontend Proxying**: Configure Vite's development server to proxy `/api` requests to the Aspire-managed API endpoint.

## Capabilities

### New Capabilities
- `solution-integration`: Integrate the Vue.js frontend into the .NET solution structure using `.esproj`.
- `federated-dev-hosting`: Orchestrate a separate Vite development server with HMR alongside the .NET API using Aspire.
- `integrated-prod-hosting`: Package the API and frontend into a single, optimized Docker container using a multi-stage build process and `pnpm`.

### Modified Capabilities
- `pwa-foundation`: Update build and deployment requirements to support the integrated production hosting model.

## Impact

- **AppHost**: Updated to include the frontend project and manage its lifecycle.
- **Web**: New `.esproj` file, updated `vite.config.ts` for proxying, and `package.json` scripts.
- **Api**: New multi-stage `Dockerfile` and potentially updated static file configuration if needed.
- **Solution**: `osi.time.tracker.slnx` will include the new `Web.esproj`.

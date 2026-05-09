## Context

The project is an Aspire-orchestrated application with a .NET API and a Vue frontend. Currently, the development workflow requires the frontend to be manually built and served by the API as static files, which is slow and lacks HMR. Production deployment needs to be packaged as a single container for simplicity.

## Goals / Non-Goals

**Goals:**
- Enable HMR in development by running a Vite dev server managed by Aspire.
- Seamlessly proxy API calls from the Vite dev server to the .NET API.
- Integrate the Vue project into the .NET solution for better IDE support.
- Automate the production build (API + Frontend) into a single Docker image using `pnpm`.

**Non-Goals:**
- Migrating the frontend to SSR or Nuxt.
- Changing the production hosting to a separate CDN (staying with the integrated model).
- Redesigning the API or database schema.

## Decisions

### 1. Project Integration via `.esproj`
- **Decision**: Create `src/Web/Web.esproj` and add it to `osi.time.tracker.slnx`.
- **Rationale**: `.esproj` is the standard way to integrate JavaScript/TypeScript projects into .NET solutions. It allows the IDE (Rider/VS) to manage scripts, dependencies, and file nesting natively.
- **Alternatives**: Using a generic folder (already done, lacks DX), or a custom MSBuild wrapper (complex and unnecessary).

### 2. Aspire Orchestration with `AddNpmApp`
- **Decision**: Use `builder.AddNpmApp("frontend", "../Web", "dev")` in `AppHost`.
- **Rationale**: Aspire's `AddNpmApp` is designed for this. It handles lifecycle, environment variables, and dashboard integration. Using `pnpm` as the package manager is supported and fast.
- **Alternatives**: Manual `npm run dev` in a separate terminal (disconnected from Aspire).

### 3. Vite Proxy for Development
- **Decision**: Configure `vite.config.ts` to proxy `/api` calls to the URL provided by the `services__api__http__0` (or similar) environment variable set by Aspire.
- **Rationale**: This allows the frontend to call `/api/weatherforecast` regardless of whether it's running in the dev server or as static files in production.
- **Alternatives**: Hardcoding URLs (unreliable across environments) or using CORS (adds overhead).

### 4. Multi-stage Dockerfile with `pnpm`
- **Decision**: Use a 3-stage Dockerfile:
    1. **Node Stage**: Install `pnpm` via `corepack`, install dependencies, and build the Vue app.
    2. **.NET Build Stage**: Standard `dotnet restore/publish`.
    3. **Final Stage**: Combine published API and Vue `dist` (into `wwwroot`).
- **Rationale**: Clean separation of concerns and optimized image size. `pnpm` is explicitly required by the user.
- **Alternatives**: Building the frontend outside the Dockerfile (not reproducible), or using a combined Node/.NET image (bloated).

## Risks / Trade-offs

- **[Risk]**: Node/pnpm version mismatch between local and Docker. → **Mitigation**: Specify versions in `package.json` and use a specific Node image tag (e.g., `node:22`).
- **[Risk]**: Aspire environment variable naming changes. → **Mitigation**: Use a robust discovery mechanism in `vite.config.ts` or explicitly map endpoints.
- **[Risk]**: `.esproj` support in older Rider versions. → **Mitigation**: Ensure Rider is up to date (standard practice in this environment).

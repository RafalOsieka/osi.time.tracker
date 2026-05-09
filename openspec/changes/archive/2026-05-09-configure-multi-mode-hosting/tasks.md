## 1. Solution Integration (DX)

- [x] 1.1 Create `src/Web/Web.esproj` with `pnpm` configuration
- [x] 1.2 Update `osi.time.tracker.slnx` to include `src/Web/Web.esproj`
- [x] 1.3 Verify `Web` project is visible in the solution explorer

## 2. Federated Development Setup (Aspire + Vite)

- [x] 2.1 Update `src/Web/package.json` with appropriate `dev` and `build` scripts for Aspire
- [x] 2.2 Configure Vite proxy in `src/Web/vite.config.ts` to forward `/api` to the Aspire API service
- [x] 2.3 Update `src/AppHost/AppHost.cs` to add the `frontend` project using `builder.AddNpmApp`
- [x] 2.4 Verify that starting `AppHost` launches both API and Vite dev server with HMR

## 3. Integrated Production Setup (Docker)

- [x] 3.1 Create a multi-stage `Dockerfile` in `src/Api/Dockerfile`
- [x] 3.2 Implement the Node.js build stage using `pnpm` (installing dependencies and running build)
- [x] 3.3 Implement the .NET build and publish stages
- [x] 3.4 Implement the final stage combining API and frontend assets in `wwwroot`
- [x] 3.5 Verify the production build by running the Docker container locally

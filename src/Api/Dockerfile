# Stage 1: Build the Vue frontend
FROM node:25-alpine AS build-web
WORKDIR /src/Web

# Install pnpm
RUN npm install -g pnpm

# Copy frontend source and build
COPY src/Web/package.json src/Web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/Web/ ./
RUN pnpm build

# Stage 2: Build the .NET API
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build-api
WORKDIR /src

# Copy solution and project files for restoration
COPY osi.time.tracker.slnx ./
COPY src/Api/Api.csproj src/Api/
COPY src/Core/Core.csproj src/Core/
COPY src/Infrastructure/Infrastructure.csproj src/Infrastructure/
COPY src/ServiceDefaults/ServiceDefaults.csproj src/ServiceDefaults/

# Restore dependencies
RUN dotnet restore src/Api/Api.csproj

# Copy remaining source code
COPY src/Api/ src/Api/
COPY src/Core/ src/Core/
COPY src/Infrastructure/ src/Infrastructure/
COPY src/ServiceDefaults/ src/ServiceDefaults/

# Build and Publish the API
RUN dotnet publish src/Api/Api.csproj -c Release -o /app/publish --no-restore

# Stage 3: Final runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Copy published API
COPY --from=build-api /app/publish .

# Copy built frontend assets to wwwroot
COPY --from=build-web /src/Web/dist ./wwwroot

ENTRYPOINT ["dotnet", "Api.dll"]

# Osi Time Tracker

A single-user time tracking application with remote publication capabilities.

## Features

- **Timer**: Single-active timer with live ticking.
- **Entries**: Review and edit your time entries.
- **Reports**: Daily and item-based summaries with CSV export.
- **Publishing**: Group and round time logs to Redmine or OpenProject.
- **Rounding**: Aggregate rounding to the nearest 15 minutes (ties up).

## Tech Stack

- **Backend**: .NET 10, ASP.NET Core Minimal APIs, EF Core.
- **Database**: PostgreSQL (via .NET Aspire).
- **Frontend**: Vue 3, Pinia, PrimeVue 4, Tailwind CSS 4.

## Setup

### Prerequisites

- .NET 10 SDK
- Docker (for PostgreSQL via Aspire)
- Node.js & pnpm

### Running the Application

1. **Database**: The application uses .NET Aspire to manage the PostgreSQL database.
2. **Start**: Run the `AppHost` project:
   ```bash
   dotnet run --project src/AppHost/AppHost.csproj
   ```
3. **UI**: Access the web interface via the URL provided by Aspire (usually port 5000/5001 or as configured).

### Configuration

- **CORS**: Ensure your Redmine/OpenProject instances allow CORS from the tracker's origin if you plan to publish directly from the browser.
- **Tokens**: API tokens for Redmine/OpenProject are stored in your browser's `localStorage` if you select "Remember". You can clear them anytime from the Publish panel.

## Development

### Running Tests

- **Backend Tests**:
  ```bash
  dotnet test src/Core.Tests/Core.Tests.csproj
  ```
- **Frontend Tests**:
  ```bash
  cd src/Web
  pnpm test
  ```

## Rounding Logic

The application follows a specific rounding rule for publishing:
1. Group all unpublished entries by (Remote Item ID, Date).
2. Sum the raw durations for each group.
3. Round the total to the nearest 15-minute increment.
4. If the total is > 0 but less than 7.5 minutes, it rounds to 15 minutes (minimum 1 step).
5. Ties (e.g., 7.5m, 22.5m) round up.

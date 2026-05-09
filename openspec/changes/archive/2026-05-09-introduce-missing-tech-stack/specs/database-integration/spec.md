## ADDED Requirements

### Requirement: PostgreSQL Orchestration with Aspire
The application MUST use .NET Aspire to orchestrate a PostgreSQL container for local development.

#### Scenario: Aspire startup with DB
- **WHEN** the Aspire AppHost starts
- **THEN** a PostgreSQL container is launched and a connection string is provided to the Api service

### Requirement: EF Core Migrations
The Infrastructure project MUST manage the database schema using Entity Framework Core migrations.

#### Scenario: Applying migrations
- **WHEN** the application starts in development
- **THEN** it checks for and applies any pending EF Core migrations automatically

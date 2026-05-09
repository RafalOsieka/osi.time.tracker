using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Npgsql;
using Projects;
using Xunit;

namespace Api.IntegrationTests;

public class ApiFixture : IAsyncLifetime
{
    private DistributedApplication? _app;
    public HttpClient HttpClient { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        var builder = await DistributedApplicationTestingBuilder.CreateAsync<AppHost>();

        // Remove frontend resource
        var frontend = builder.Resources.FirstOrDefault(r => r.Name == "frontend");
        if (frontend is not null)
            builder.Resources.Remove(frontend);

        // Remove pgweb resource
        var pgweb = builder.Resources.FirstOrDefault(r => r.Name == "pgweb");
        if (pgweb is not null)
            builder.Resources.Remove(pgweb);

        // Remove named volume annotation from postgres to get ephemeral container
        var postgres = builder.Resources.FirstOrDefault(r => r.Name == "postgres");
        if (postgres is not null)
        {
            var volumeAnnotation = postgres.Annotations
                .OfType<ContainerMountAnnotation>()
                .FirstOrDefault(a => a.Target == "/var/lib/postgresql/data");
            if (volumeAnnotation is not null)
                postgres.Annotations.Remove(volumeAnnotation);
        }

        _app = await builder.BuildAsync();
        await _app.StartAsync();
        await _app.ResourceNotifications.WaitForResourceHealthyAsync("api",
            new CancellationTokenSource(TimeSpan.FromSeconds(60)).Token);

        HttpClient = _app.CreateHttpClient("api");
        HttpClient.BaseAddress = new Uri(HttpClient.BaseAddress!, "/api/");
    }

    public async Task DisposeAsync()
    {
        if (_app is not null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }

        HttpClient?.Dispose();
    }

    public async Task ResetDatabaseAsync()
    {
        var connectionString = await _app!.GetConnectionStringAsync("osi-time-tracker-db");
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
                          DO $$ BEGIN
                            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'TimeEntries') THEN
                              TRUNCATE TABLE "TimeEntries", "Items", "Projects" RESTART IDENTITY CASCADE;
                            END IF;
                          END $$;
                          """;
        await cmd.ExecuteNonQueryAsync();
    }
}

[CollectionDefinition("Api")]
public class ApiTests : ICollectionFixture<ApiFixture>;
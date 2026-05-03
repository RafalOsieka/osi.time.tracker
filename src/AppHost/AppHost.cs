using Projects;

var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("osi-time-tracker-postgres-data")
    .WithPgWeb()
    .AddDatabase("osi-time-tracker-db");

var api = builder.AddProject<Api>("api")
    .WithReference(postgres)
    .WaitFor(postgres);

builder.AddNpmApp("frontend", "../Web", "dev")
    .WithReference(api)
    .WithHttpsEndpoint(targetPort: 5173)
    .WithExternalHttpEndpoints();

builder.Build().Run();
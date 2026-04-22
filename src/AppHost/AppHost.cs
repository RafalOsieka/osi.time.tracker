using Projects;

var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .AddDatabase("osi-time-tracker-db");

var api = builder.AddProject<Api>("api")
    .WithReference(postgres)
    .WaitFor(postgres);

builder.AddNpmApp("frontend", "../Web")
    .WithReference(api)
    .WithHttpEndpoint(port: 5173, targetPort: 5173)
    .WithExternalHttpEndpoints();

builder.Build().Run();
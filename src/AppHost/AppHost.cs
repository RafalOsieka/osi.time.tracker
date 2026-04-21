var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .AddDatabase("trackerdb");

builder.AddProject<Projects.Api>("api")
    .WithReference(postgres)
    .WaitFor(postgres);

builder.Build().Run();

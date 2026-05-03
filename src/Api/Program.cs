using System.Text.Json.Serialization;
using osi.time.tracker.Api.Endpoints;
using osi.time.tracker.Core;
using osi.time.tracker.Infrastructure;
using osi.time.tracker.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddServiceDefaults();
builder.AddCore();
builder.AddInfrastructure();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

app.MapDefaultEndpoints();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapApiEndpoints();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.UseHttpsRedirection();

app.MapFallbackToFile("index.html");

await app.MigrateAndSeedAsync();

app.Run();
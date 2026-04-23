using Microsoft.AspNetCore.Mvc;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Api.Endpoints;

public static class ApiEndpoints
{
    public static void MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        // Timer
        var timer = api.MapGroup("/timer");
        timer.MapGet("/active", async (TimerService timerService, CancellationToken ct) =>
        {
            var active = await timerService.GetActiveAsync(ct);
            return active is null ? Results.NotFound() : Results.Ok(active);
        });

        timer.MapPost("/start", async ([FromBody] StartTimerRequest request, TimerService timerService, CancellationToken ct) =>
        {
            var result = await timerService.StartAsync(request.ItemId, request.Title, request.Note, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        timer.MapPost("/stop", async (TimerService timerService, CancellationToken ct) =>
        {
            var result = await timerService.StopAsync(ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        // Entries
        var entries = api.MapGroup("/entries");
        entries.MapGet("/", async ([FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] Guid? itemId, TimeEntryService entryService, CancellationToken ct) =>
        {
            var results = await entryService.GetAsync(from, to, itemId, ct);
            return Results.Ok(results);
        });

        entries.MapPost("/", async ([FromBody] CreateEntryRequest request, TimeEntryService entryService, CancellationToken ct) =>
        {
            var result = await entryService.CreateAsync(request.ItemId, request.Title, request.Note, request.StartUtc, request.EndUtc, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        entries.MapPut("/{id}", async (Guid id, [FromBody] UpdateEntryRequest request, TimeEntryService entryService, CancellationToken ct) =>
        {
            var result = await entryService.UpdateAsync(id, request.Title, request.Note, request.StartUtc, request.EndUtc, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        entries.MapDelete("/{id}", async (Guid id, TimeEntryService entryService, CancellationToken ct) =>
        {
            var result = await entryService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });

        // Items
        var items = api.MapGroup("/items");
        items.MapGet("/", async (ItemService itemService, CancellationToken ct) =>
        {
            var results = await itemService.GetAllAsync(ct);
            return Results.Ok(results);
        });

        items.MapGet("/{id}", async (Guid id, ItemService itemService, CancellationToken ct) =>
        {
            var item = await itemService.GetByIdAsync(id, ct);
            return item is null ? Results.NotFound() : Results.Ok(item);
        });

        items.MapPost("/", async ([FromBody] CreateItemRequest request, ItemService itemService, CancellationToken ct) =>
        {
            var result = await itemService.CreateAsync(request.ProjectId, request.Name, request.RemoteTarget, request.RemoteBaseUrl, request.RemoteId, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        items.MapPut("/{id}", async (Guid id, [FromBody] UpdateItemRequest request, ItemService itemService, CancellationToken ct) =>
        {
            var result = await itemService.UpdateAsync(id, request.Name, request.IsArchived, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        items.MapDelete("/{id}", async (Guid id, ItemService itemService, CancellationToken ct) =>
        {
            var result = await itemService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });

        // Projects
        var projects = api.MapGroup("/projects");
        projects.MapGet("/", async (ProjectService projectService, CancellationToken ct) =>
        {
            var results = await projectService.GetAllAsync(ct);
            return Results.Ok(results);
        });

        projects.MapGet("/{id}", async (Guid id, ProjectService projectService, CancellationToken ct) =>
        {
            var project = await projectService.GetByIdAsync(id, ct);
            return project is null ? Results.NotFound() : Results.Ok(project);
        });

        projects.MapPost("/", async ([FromBody] CreateProjectRequest request, ProjectService projectService, CancellationToken ct) =>
        {
            var result = await projectService.CreateAsync(request.Name, request.Color, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        projects.MapPut("/{id}", async (Guid id, [FromBody] UpdateProjectRequest request, ProjectService projectService, CancellationToken ct) =>
        {
            var result = await projectService.UpdateAsync(id, request.Name, request.Color, request.IsArchived, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });

        projects.MapDelete("/{id}", async (Guid id, ProjectService projectService, CancellationToken ct) =>
        {
            var result = await projectService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });

        // Reports
        var reports = api.MapGroup("/reports");
        reports.MapGet("/daily", async ([FromQuery] DateTime from, [FromQuery] DateTime to, ReportService reportService, CancellationToken ct) =>
        {
            var result = await reportService.GetDailyReportAsync(from, to, ct);
            return Results.Ok(result);
        });

        reports.MapGet("/by-item", async ([FromQuery] DateTime from, [FromQuery] DateTime to, ReportService reportService, CancellationToken ct) =>
        {
            var result = await reportService.GetItemReportAsync(from, to, ct);
            return Results.Ok(result);
        });
    }

    // Requests
    public record StartTimerRequest(Guid ItemId, string Title, string? Note);
    public record CreateEntryRequest(Guid ItemId, string Title, string? Note, DateTime StartUtc, DateTime? EndUtc);
    public record UpdateEntryRequest(string Title, string? Note, DateTime StartUtc, DateTime? EndUtc);
    public record CreateItemRequest(Guid ProjectId, string Name, RemoteTarget RemoteTarget, string RemoteBaseUrl, string RemoteId);
    public record UpdateItemRequest(string Name, bool IsArchived);
    public record CreateProjectRequest(string Name, string? Color);
    public record UpdateProjectRequest(string Name, string? Color, bool IsArchived);
}

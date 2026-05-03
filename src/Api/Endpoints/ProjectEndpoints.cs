using Microsoft.AspNetCore.Mvc;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Api.Endpoints;

public static class ProjectEndpoints
{
    public static void MapProjectEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/projects");

        group.MapGet("/", async (ProjectService projectService, CancellationToken ct) =>
        {
            var results = await projectService.GetAllAsync(ct);
            return Results.Ok(results);
        });

        group.MapGet("/{id:guid}", async (Guid id, ProjectService projectService, CancellationToken ct) =>
        {
            var project = await projectService.GetByIdAsync(id, ct);
            return project is null ? Results.NotFound() : Results.Ok(project);
        });

        group.MapPost("/",
            async ([FromBody] CreateProjectRequest request, ProjectService projectService, CancellationToken ct) =>
            {
                var result = await projectService.CreateAsync(request.Name, request.Color, request.IsDefault,
                    request.RemoteTarget, request.RemoteBaseUrl, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPut("/{id:guid}",
            async (Guid id, [FromBody] UpdateProjectRequest request, ProjectService projectService,
                CancellationToken ct) =>
            {
                var result = await projectService.UpdateAsync(id, request.Name, request.Color, request.IsArchived,
                    request.IsDefault, request.RemoteTarget, request.RemoteBaseUrl, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapDelete("/{id:guid}", async (Guid id, ProjectService projectService, CancellationToken ct) =>
        {
            var result = await projectService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });
    }
}

public record CreateProjectRequest(
    string Name,
    string? Color,
    bool IsDefault = false,
    RemoteTarget? RemoteTarget = null,
    string? RemoteBaseUrl = null);

public record UpdateProjectRequest(
    string Name,
    string? Color,
    bool IsArchived,
    bool IsDefault,
    RemoteTarget? RemoteTarget,
    string? RemoteBaseUrl);

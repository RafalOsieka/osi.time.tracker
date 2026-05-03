using Microsoft.AspNetCore.Mvc;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Api.Endpoints;

public static class ItemEndpoints
{
    public static void MapItemEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/items");

        group.MapGet("/", async (ItemService itemService, CancellationToken ct) =>
        {
            var results = await itemService.GetAllAsync(ct);
            return Results.Ok(results);
        });

        group.MapGet("/{id:guid}", async (Guid id, ItemService itemService, CancellationToken ct) =>
        {
            var item = await itemService.GetByIdAsync(id, ct);
            return item is null ? Results.NotFound() : Results.Ok(item);
        });

        group.MapPost("/",
            async ([FromBody] CreateItemRequest request, ItemService itemService, CancellationToken ct) =>
            {
                var result = await itemService.CreateAsync(request.ProjectId, request.Name, request.RemoteTarget,
                    request.RemoteBaseUrl, request.RemoteId, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPut("/{id:guid}",
            async (Guid id, [FromBody] UpdateItemRequest request, ItemService itemService, CancellationToken ct) =>
            {
                var result = await itemService.UpdateAsync(id, request.Name, request.IsArchived, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapDelete("/{id:guid}", async (Guid id, ItemService itemService, CancellationToken ct) =>
        {
            var result = await itemService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });
    }
}

public record CreateItemRequest(
    Guid ProjectId,
    string Name,
    RemoteTarget RemoteTarget,
    string RemoteBaseUrl,
    string RemoteId);

public record UpdateItemRequest(string Name, bool IsArchived);
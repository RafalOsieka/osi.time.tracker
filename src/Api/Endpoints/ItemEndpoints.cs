using Microsoft.AspNetCore.Mvc;
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
                var result = await itemService.CreateAsync(request.ProjectId, request.Title, request.RemoteId, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPut("/{id:guid}",
            async (Guid id, [FromBody] UpdateItemRequest request, ItemService itemService, CancellationToken ct) =>
            {
                var result = await itemService.UpdateAsync(id, request.Title, request.IsArchived, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPatch("/{id:guid}/match",
            async (Guid id, [FromBody] MatchItemRequest request, ItemService itemService, CancellationToken ct) =>
            {
                var result = await itemService.MatchRemoteAsync(id, request.RemoteId, request.RemoteTitle, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPost("/merge",
            async ([FromBody] MergeItemsRequest request, ItemService itemService, CancellationToken ct) =>
            {
                var result = await itemService.MergeAsync(request.SourceId, request.TargetId, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapDelete("/{id:guid}", async (Guid id, ItemService itemService, CancellationToken ct) =>
        {
            var result = await itemService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });
    }
}

public record CreateItemRequest(Guid ProjectId, string Title, string? RemoteId);

public record UpdateItemRequest(string Title, bool IsArchived);

public record MatchItemRequest(string RemoteId, string RemoteTitle);

public record MergeItemsRequest(Guid SourceId, Guid TargetId);

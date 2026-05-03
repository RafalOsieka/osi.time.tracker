using Microsoft.AspNetCore.Mvc;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Api.Endpoints;

public static class EntryEndpoints
{
    public static void MapEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/entries");

        group.MapGet("/",
            async ([FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] Guid? itemId,
                TimeEntryService entryService, CancellationToken ct) =>
            {
                var results = await entryService.GetAsync(from, to, itemId, ct);
                return Results.Ok(results);
            });

        group.MapPost("/",
            async ([FromBody] CreateEntryRequest request, TimeEntryService entryService, CancellationToken ct) =>
            {
                var result = await entryService.CreateAsync(request.ItemId, request.Title,
                    request.StartUtc, request.EndUtc, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPut("/{id:guid}",
            async (Guid id, [FromBody] UpdateEntryRequest request, TimeEntryService entryService,
                CancellationToken ct) =>
            {
                var result = await entryService.UpdateAsync(id, request.Title,
                    request.StartUtc, request.EndUtc, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapDelete("/{id:guid}", async (Guid id, TimeEntryService entryService, CancellationToken ct) =>
        {
            var result = await entryService.DeleteAsync(id, ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.NoContent();
        });
    }
}

public record CreateEntryRequest(Guid ItemId, string Title, DateTime StartUtc, DateTime? EndUtc);

public record UpdateEntryRequest(string Title, DateTime StartUtc, DateTime? EndUtc);

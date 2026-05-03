using Microsoft.AspNetCore.Mvc;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Api.Endpoints;

public static class TimerEndpoints
{
    public static void MapTimerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/timer");

        group.MapGet("/active", async (TimerService timerService, CancellationToken ct) =>
        {
            var active = await timerService.GetActiveAsync(ct);
            return active is null ? Results.NotFound() : Results.Ok(active);
        });

        group.MapPost("/start",
            async ([FromBody] StartTimerRequest request, TimerService timerService, CancellationToken ct) =>
            {
                var result = await timerService.StartAsync(request.ItemId, request.Title, request.Note, ct);
                return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
            });

        group.MapPost("/stop", async (TimerService timerService, CancellationToken ct) =>
        {
            var result = await timerService.StopAsync(ct);
            return result.IsFailure ? Results.BadRequest(result.Error) : Results.Ok(result.Value);
        });
    }
}

public record StartTimerRequest(Guid ItemId, string Title, string? Note);
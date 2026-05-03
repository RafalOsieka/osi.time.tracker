using Microsoft.AspNetCore.Mvc;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Api.Endpoints;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/reports");

        group.MapGet("/daily",
            async ([FromQuery] DateTime from, [FromQuery] DateTime to, ReportService reportService,
                CancellationToken ct) =>
            {
                var result = await reportService.GetDailyReportAsync(from, to, ct);
                return Results.Ok(result);
            });

        group.MapGet("/by-item",
            async ([FromQuery] DateTime from, [FromQuery] DateTime to, ReportService reportService,
                CancellationToken ct) =>
            {
                var result = await reportService.GetItemReportAsync(from, to, ct);
                return Results.Ok(result);
            });
    }
}
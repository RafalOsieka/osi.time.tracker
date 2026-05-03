namespace osi.time.tracker.Api.Endpoints;

public static class ApiEndpoints
{
    public static void MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapTimerEndpoints();
        api.MapEntryEndpoints();
        api.MapItemEndpoints();
        api.MapProjectEndpoints();
        api.MapReportEndpoints();
    }
}
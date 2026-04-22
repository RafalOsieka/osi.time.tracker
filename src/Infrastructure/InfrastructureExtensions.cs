using Microsoft.Extensions.Hosting;
using osi.time.tracker.Infrastructure.Persistence;

namespace osi.time.tracker.Infrastructure;

public static class InfrastructureExtensions
{
    public static IHostApplicationBuilder AddInfrastructure(this IHostApplicationBuilder builder)
    {
        builder.AddNpgsqlDbContext<ApplicationDbContext>("trackerdb");

        return builder;
    }
}
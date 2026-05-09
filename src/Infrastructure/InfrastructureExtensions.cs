using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using osi.time.tracker.Core.Persistence;
using osi.time.tracker.Infrastructure.Persistence;

namespace osi.time.tracker.Infrastructure;

public static class InfrastructureExtensions
{
    public static IHostApplicationBuilder AddInfrastructure(this IHostApplicationBuilder builder)
    {
        builder.AddNpgsqlDbContext<ApplicationDbContext>("osi-time-tracker-db");
        builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

        return builder;
    }
}
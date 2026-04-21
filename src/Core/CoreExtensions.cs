using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Core;

public static class CoreExtensions
{
    public static IHostApplicationBuilder AddCore(this IHostApplicationBuilder builder)
    {
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddScoped<SampleService>();
        
        return builder;
    }
}
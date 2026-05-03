using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Services;

namespace osi.time.tracker.Infrastructure.Persistence;

public static class SeedData
{
    public static async Task MigrateAndSeedAsync(this IHost host)
    {
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        await db.Database.MigrateAsync();
        await SeedDefaultProjectAsync(db);
    }

    /// <summary>
    /// Ensures exactly one Project exists with <see cref="Project.IsDefault"/> = true.
    /// Creates the system "Local" project on first run.
    /// </summary>
    public static async Task SeedDefaultProjectAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        if (await db.Projects.AnyAsync(p => p.IsDefault, ct))
            return;

        var now = DateTime.UtcNow;
        db.Projects.Add(new Project
        {
            Id = Guid.NewGuid(),
            Name = ProjectService.DefaultProjectName,
            IsDefault = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await db.SaveChangesAsync(ct);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using osi.time.tracker.Core.Entities;

namespace osi.time.tracker.Infrastructure.Persistence;

public static class SeedData
{
    public static async Task MigrateAndSeedAsync(this IHost host)
    {
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        await db.Database.MigrateAsync();

        if (await db.Projects.AnyAsync())
            return;

        var now = DateTime.UtcNow;

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Sample Project",
            Color = "#4f46e5",
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.Projects.Add(project);

        var item = new Item
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            Name = "Sample Issue #1",
            RemoteTarget = RemoteTarget.Redmine,
            RemoteBaseUrl = "https://redmine.example.com",
            RemoteId = "1",
            CreatedUtc = now,
            UpdatedUtc = now
        };
        db.Items.Add(item);

        await db.SaveChangesAsync();
    }
}

using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Common;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class TimerService(IAppDbContext db, TimeProvider timeProvider, ProjectService projectService)
{
    public async Task<TimeEntry?> GetActiveAsync(CancellationToken ct = default)
    {
        return await db.TimeEntries
            .Include(e => e.Item)
            .ThenInclude(i => i.Project)
            .FirstOrDefaultAsync(e => e.EndUtc == null, ct);
    }

    /// <summary>
    /// Starts a timer. If <paramref name="itemId"/> is null, an implicit Item is created
    /// under the Default Project, using <paramref name="title"/> as its cached title.
    /// </summary>
    public async Task<Result<TimeEntry>> StartAsync(Guid? itemId, string title, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(title))
            return Result<TimeEntry>.Failure("Title is required.");

        var active = await db.TimeEntries.FirstOrDefaultAsync(e => e.EndUtc == null, ct);
        if (active is not null)
            return Result<TimeEntry>.Failure("Another entry is already running. Stop it first.");

        Item item;
        var now = timeProvider.GetUtcNow().UtcDateTime;
        if (itemId.HasValue)
        {
            var existing = await db.Items
                .Include(i => i.Project)
                .FirstOrDefaultAsync(i => i.Id == itemId.Value, ct);
            if (existing is null)
                return Result<TimeEntry>.Failure("Item not found.");
            item = existing;
        }
        else
        {
            var defaultProject = await projectService.GetOrCreateDefaultAsync(ct);
            item = new Item
            {
                Id = Guid.NewGuid(),
                ProjectId = defaultProject.Id,
                Project = defaultProject,
                Title = title,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            db.Items.Add(item);
        }

        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            ItemId = item.Id,
            Title = title,
            StartUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        entry.Item = item;
        return Result<TimeEntry>.Success(entry);
    }

    public async Task<Result<TimeEntry>> StopAsync(CancellationToken ct = default)
    {
        var active = await db.TimeEntries
            .Include(e => e.Item)
            .ThenInclude(i => i.Project)
            .FirstOrDefaultAsync(e => e.EndUtc == null, ct);

        if (active is null)
            return Result<TimeEntry>.Failure("No active timer to stop.");

        var now = timeProvider.GetUtcNow().UtcDateTime;
        active.EndUtc = now;
        active.UpdatedUtc = now;

        await db.SaveChangesAsync(ct);
        return Result<TimeEntry>.Success(active);
    }
}

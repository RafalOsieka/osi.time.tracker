using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Common;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class TimerService(IAppDbContext db, TimeProvider timeProvider)
{
    public async Task<TimeEntry?> GetActiveAsync(CancellationToken ct = default)
    {
        return await db.TimeEntries
            .Include(e => e.Item)
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.EndUtc == null, ct);
    }

    public async Task<Result<TimeEntry>> StartAsync(Guid itemId, string title, string? note, CancellationToken ct = default)
    {
        var active = await db.TimeEntries.FirstOrDefaultAsync(e => e.EndUtc == null, ct);
        if (active is not null)
            return Result<TimeEntry>.Failure("Another entry is already running. Stop it first.");

        var item = await db.Items.Include(i => i.Project).FirstOrDefaultAsync(i => i.Id == itemId, ct);
        if (item is null)
            return Result<TimeEntry>.Failure("Item not found.");

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            ProjectId = item.ProjectId,
            ItemId = item.Id,
            Title = title,
            Note = note,
            StartUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        entry.Item = item;
        entry.Project = item.Project;
        return Result<TimeEntry>.Success(entry);
    }

    public async Task<Result<TimeEntry>> StopAsync(CancellationToken ct = default)
    {
        var active = await db.TimeEntries
            .Include(e => e.Item)
            .Include(e => e.Project)
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

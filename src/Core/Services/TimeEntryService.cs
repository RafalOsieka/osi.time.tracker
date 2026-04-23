using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Common;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class TimeEntryService(IAppDbContext db, TimeProvider timeProvider)
{
    public async Task<List<TimeEntry>> GetAsync(DateTime from, DateTime to, Guid? itemId = null, CancellationToken ct = default)
    {
        var query = db.TimeEntries
            .Include(e => e.Item)
            .Include(e => e.Project)
            .Where(e => e.StartUtc >= from && e.StartUtc < to);

        if (itemId.HasValue)
            query = query.Where(e => e.ItemId == itemId.Value);

        return await query.OrderByDescending(e => e.StartUtc).ToListAsync(ct);
    }

    public async Task<Result<TimeEntry>> CreateAsync(Guid itemId, string title, string? note, DateTime startUtc, DateTime? endUtc, CancellationToken ct = default)
    {
        var item = await db.Items.Include(i => i.Project).FirstOrDefaultAsync(i => i.Id == itemId, ct);
        if (item is null)
            return Result<TimeEntry>.Failure("Item not found.");

        if (endUtc.HasValue && endUtc.Value <= startUtc)
            return Result<TimeEntry>.Failure("End time must be after start time.");

        var overlapCheck = await CheckOverlapAsync(startUtc, endUtc, null, ct);
        if (overlapCheck.IsFailure)
            return Result<TimeEntry>.Failure(overlapCheck.Error);

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            ProjectId = item.ProjectId,
            ItemId = item.Id,
            Title = title,
            Note = note,
            StartUtc = startUtc,
            EndUtc = endUtc,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        entry.Item = item;
        entry.Project = item.Project;
        return Result<TimeEntry>.Success(entry);
    }

    public async Task<Result<TimeEntry>> UpdateAsync(Guid id, string title, string? note, DateTime startUtc, DateTime? endUtc, CancellationToken ct = default)
    {
        var entry = await db.TimeEntries
            .Include(e => e.Item)
            .Include(e => e.Project)
            .FirstOrDefaultAsync(e => e.Id == id, ct);

        if (entry is null)
            return Result<TimeEntry>.Failure("Time entry not found.");

        if (endUtc.HasValue && endUtc.Value <= startUtc)
            return Result<TimeEntry>.Failure("End time must be after start time.");

        var overlapCheck = await CheckOverlapAsync(startUtc, endUtc, id, ct);
        if (overlapCheck.IsFailure)
            return Result<TimeEntry>.Failure(overlapCheck.Error);

        entry.Title = title;
        entry.Note = note;
        entry.StartUtc = startUtc;
        entry.EndUtc = endUtc;
        entry.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Result<TimeEntry>.Success(entry);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entry = await db.TimeEntries.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entry is null)
            return Result.Failure("Time entry not found.");

        db.TimeEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Result> CheckOverlapAsync(DateTime startUtc, DateTime? endUtc, Guid? excludeId, CancellationToken ct)
    {
        var query = db.TimeEntries.AsQueryable();
        if (excludeId.HasValue)
            query = query.Where(e => e.Id != excludeId.Value);

        // An entry overlaps if its range intersects with the new range.
        // For open-ended entries (running), treat EndUtc as "infinity".
        var hasOverlap = await query.AnyAsync(e =>
            e.StartUtc < (endUtc ?? DateTime.MaxValue) &&
            (e.EndUtc ?? DateTime.MaxValue) > startUtc, ct);

        return hasOverlap ? Result.Failure("Time entry overlaps with an existing entry.") : Result.Success();
    }
}

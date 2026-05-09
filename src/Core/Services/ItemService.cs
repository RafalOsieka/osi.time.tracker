using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Common;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class ItemService(IAppDbContext db, TimeProvider timeProvider)
{
    public async Task<List<Item>> GetAllAsync(CancellationToken ct = default)
    {
        return await db.Items
            .Include(i => i.Project)
            .OrderBy(i => i.Title)
            .ToListAsync(ct);
    }

    public async Task<Item?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Items
            .Include(i => i.Project)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<Item?> FindByRemoteAsync(Guid projectId, string remoteId, CancellationToken ct = default)
    {
        return await db.Items
            .Include(i => i.Project)
            .FirstOrDefaultAsync(i => i.ProjectId == projectId && i.RemoteId == remoteId, ct);
    }

    public async Task<Result<Item>> CreateAsync(Guid projectId, string title, string? remoteId,
        CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project is null)
            return Result<Item>.Failure("Project not found.");

        var validation = await ValidateRemoteIdAsync(project, remoteId, null, ct);
        if (validation.IsFailure)
            return Result<Item>.Failure(validation.Error);

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var item = new Item
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Title = title,
            RemoteId = string.IsNullOrWhiteSpace(remoteId) ? null : remoteId,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.Items.Add(item);
        await db.SaveChangesAsync(ct);

        item.Project = project;
        return Result<Item>.Success(item);
    }

    public async Task<Result<Item>> UpdateAsync(Guid id, string title, bool isArchived, CancellationToken ct = default)
    {
        var item = await db.Items.Include(i => i.Project).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null)
            return Result<Item>.Failure("Item not found.");

        item.Title = title;
        item.IsArchived = isArchived;
        item.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Result<Item>.Success(item);
    }

    /// <summary>
    ///     Associates an item with a remote ID and updates its cached title.
    /// </summary>
    public async Task<Result<Item>> MatchRemoteAsync(Guid id, string remoteId, string remoteTitle,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remoteId))
            return Result<Item>.Failure("RemoteId is required.");

        var item = await db.Items.Include(i => i.Project).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null)
            return Result<Item>.Failure("Item not found.");

        if (!item.Project.IsRemote)
            return Result<Item>.Failure("Items can only be matched to a remote ID within a remote-configured project.");

        var validation = await ValidateRemoteIdAsync(item.Project, remoteId, item.Id, ct);
        if (validation.IsFailure)
            return Result<Item>.Failure(validation.Error);

        item.RemoteId = remoteId;
        if (!string.IsNullOrWhiteSpace(remoteTitle))
            item.Title = remoteTitle;
        item.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Result<Item>.Success(item);
    }

    /// <summary>
    ///     Moves all TimeEntries from <paramref name="sourceId" /> into <paramref name="targetId" /> and archives the source.
    /// </summary>
    public async Task<Result<Item>> MergeAsync(Guid sourceId, Guid targetId, CancellationToken ct = default)
    {
        if (sourceId == targetId)
            return Result<Item>.Failure("Source and target items must differ.");

        var source = await db.Items.FirstOrDefaultAsync(i => i.Id == sourceId, ct);
        if (source is null)
            return Result<Item>.Failure("Source item not found.");

        var target = await db.Items.Include(i => i.Project).FirstOrDefaultAsync(i => i.Id == targetId, ct);
        if (target is null)
            return Result<Item>.Failure("Target item not found.");

        var entries = await db.TimeEntries.Where(e => e.ItemId == sourceId).ToListAsync(ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        foreach (var entry in entries)
        {
            entry.ItemId = targetId;
            entry.UpdatedUtc = now;
        }

        source.IsArchived = true;
        source.UpdatedUtc = now;

        await db.SaveChangesAsync(ct);
        return Result<Item>.Success(target);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null)
            return Result.Failure("Item not found.");

        db.Items.Remove(item);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Result> ValidateRemoteIdAsync(Project project, string? remoteId, Guid? excludeId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(remoteId))
            return Result.Success();

        if (!project.IsRemote)
            return Result.Failure("RemoteId can only be set on items belonging to a remote-configured project.");

        var clash = await db.Items.AnyAsync(i =>
            i.ProjectId == project.Id &&
            i.RemoteId == remoteId &&
            (excludeId == null || i.Id != excludeId), ct);

        return clash
            ? Result.Failure("Another item in this project already maps to this remote ID.")
            : Result.Success();
    }
}
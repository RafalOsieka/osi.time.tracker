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
            .OrderBy(i => i.Name)
            .ToListAsync(ct);
    }

    public async Task<Item?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Items
            .Include(i => i.Project)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<Item?> FindByRemoteAsync(RemoteTarget target, string baseUrl, string remoteId, CancellationToken ct = default)
    {
        return await db.Items
            .Include(i => i.Project)
            .FirstOrDefaultAsync(i =>
                i.RemoteTarget == target &&
                i.RemoteBaseUrl == baseUrl &&
                i.RemoteId == remoteId, ct);
    }

    public async Task<Result<Item>> CreateAsync(Guid projectId, string name, RemoteTarget remoteTarget, string remoteBaseUrl, string remoteId, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project is null)
            return Result<Item>.Failure("Project not found.");

        var exists = await db.Items.AnyAsync(i =>
            i.RemoteTarget == remoteTarget &&
            i.RemoteBaseUrl == remoteBaseUrl &&
            i.RemoteId == remoteId, ct);

        if (exists)
            return Result<Item>.Failure("An item with the same remote target, base URL, and remote ID already exists.");

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var item = new Item
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Name = name,
            RemoteTarget = remoteTarget,
            RemoteBaseUrl = remoteBaseUrl,
            RemoteId = remoteId,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.Items.Add(item);
        await db.SaveChangesAsync(ct);

        item.Project = project;
        return Result<Item>.Success(item);
    }

    public async Task<Result<Item>> UpdateAsync(Guid id, string name, bool isArchived, CancellationToken ct = default)
    {
        var item = await db.Items.Include(i => i.Project).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null)
            return Result<Item>.Failure("Item not found.");

        item.Name = name;
        item.IsArchived = isArchived;
        item.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Result<Item>.Success(item);
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
}

using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Common;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class ProjectService(IAppDbContext db, TimeProvider timeProvider)
{
    public async Task<List<Project>> GetAllAsync(CancellationToken ct = default)
    {
        return await db.Projects.OrderBy(p => p.Name).ToListAsync(ct);
    }

    public async Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<Result<Project>> CreateAsync(string name, string? color, CancellationToken ct = default)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = name,
            Color = color,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return Result<Project>.Success(project);
    }

    public async Task<Result<Project>> UpdateAsync(Guid id, string name, string? color, bool isArchived,
        CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (project is null)
            return Result<Project>.Failure("Project not found.");

        project.Name = name;
        project.Color = color;
        project.IsArchived = isArchived;
        project.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Result<Project>.Success(project);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (project is null)
            return Result.Failure("Project not found.");

        db.Projects.Remove(project);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
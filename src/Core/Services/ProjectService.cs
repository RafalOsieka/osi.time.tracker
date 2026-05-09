using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Common;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class ProjectService(IAppDbContext db, TimeProvider timeProvider)
{
    public const string DefaultProjectName = "Local";

    public async Task<List<Project>> GetAllAsync(CancellationToken ct = default)
    {
        return await db.Projects.OrderBy(p => p.Name).ToListAsync(ct);
    }

    public async Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<Project> GetOrCreateDefaultAsync(CancellationToken ct = default)
    {
        var existing = await db.Projects.FirstOrDefaultAsync(p => p.IsDefault, ct);
        if (existing is not null)
            return existing;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = DefaultProjectName,
            IsDefault = true,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return project;
    }

    public async Task<Result<Project>> CreateAsync(string name, string? color, bool isDefault,
        RemoteTarget? remoteTarget, string? remoteBaseUrl, CancellationToken ct = default)
    {
        var validation = ValidateRemoteConfig(remoteTarget, remoteBaseUrl);
        if (validation.IsFailure)
            return Result<Project>.Failure(validation.Error);

        if (await db.Projects.AnyAsync(p => p.Name == name, ct))
            return Result<Project>.Failure("A project with this name already exists.");

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = name,
            Color = color,
            IsDefault = false,
            RemoteTarget = remoteTarget,
            RemoteBaseUrl = remoteBaseUrl,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        if (isDefault)
        {
            await ClearCurrentDefaultAsync(null, ct);
            project.IsDefault = true;
        }

        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return Result<Project>.Success(project);
    }

    public async Task<Result<Project>> UpdateAsync(Guid id, string name, string? color, bool isArchived,
        bool isDefault, RemoteTarget? remoteTarget, string? remoteBaseUrl, CancellationToken ct = default)
    {
        var validation = ValidateRemoteConfig(remoteTarget, remoteBaseUrl);
        if (validation.IsFailure)
            return Result<Project>.Failure(validation.Error);

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (project is null)
            return Result<Project>.Failure("Project not found.");

        if (project.IsDefault && !isDefault)
            return Result<Project>.Failure(
                "The default project cannot be unset; mark another project as default instead.");

        if (await db.Projects.AnyAsync(p => p.Name == name && p.Id != id, ct))
            return Result<Project>.Failure("A project with this name already exists.");

        if (isDefault && !project.IsDefault)
            await ClearCurrentDefaultAsync(id, ct);

        project.Name = name;
        project.Color = color;
        project.IsArchived = isArchived;
        project.IsDefault = isDefault;
        project.RemoteTarget = remoteTarget;
        project.RemoteBaseUrl = remoteBaseUrl;
        project.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Result<Project>.Success(project);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (project is null)
            return Result.Failure("Project not found.");

        if (project.IsDefault)
            return Result.Failure("The default project cannot be deleted.");

        db.Projects.Remove(project);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task ClearCurrentDefaultAsync(Guid? exceptId, CancellationToken ct)
    {
        var currentDefault = await db.Projects
            .FirstOrDefaultAsync(p => p.IsDefault && (exceptId == null || p.Id != exceptId), ct);
        if (currentDefault is not null)
        {
            currentDefault.IsDefault = false;
            currentDefault.UpdatedUtc = timeProvider.GetUtcNow().UtcDateTime;
        }
    }

    private static Result ValidateRemoteConfig(RemoteTarget? remoteTarget, string? remoteBaseUrl)
    {
        if (!remoteTarget.HasValue)
            return string.IsNullOrWhiteSpace(remoteBaseUrl)
                ? Result.Success()
                : Result.Failure("RemoteBaseUrl can only be set when RemoteTarget is specified.");

        if (string.IsNullOrWhiteSpace(remoteBaseUrl))
            return Result.Failure("RemoteBaseUrl is required when RemoteTarget is set.");

        return Uri.TryCreate(remoteBaseUrl, UriKind.Absolute, out _)
            ? Result.Success()
            : Result.Failure("RemoteBaseUrl must be a valid absolute URI.");
    }
}
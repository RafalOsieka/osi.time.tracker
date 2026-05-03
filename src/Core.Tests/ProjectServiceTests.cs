using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Services;
using osi.time.tracker.Infrastructure.Persistence;
using Xunit;

namespace osi.time.tracker.Core.Tests;

public class ProjectServiceTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly ProjectService _service;

    public ProjectServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _db = new ApplicationDbContext(options);
        _service = new ProjectService(_db, TimeProvider.System);
    }

    [Fact]
    public async Task GetOrCreateDefaultAsyncShouldCreateDefaultOnFirstCall()
    {
        var project = await _service.GetOrCreateDefaultAsync();

        Assert.True(project.IsDefault);
        Assert.Equal(ProjectService.DefaultProjectName, project.Name);
        Assert.Equal(1, await _db.Projects.CountAsync(p => p.IsDefault));
    }

    [Fact]
    public async Task GetOrCreateDefaultAsyncShouldReturnExistingDefault()
    {
        var first = await _service.GetOrCreateDefaultAsync();
        var second = await _service.GetOrCreateDefaultAsync();

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await _db.Projects.CountAsync(p => p.IsDefault));
    }

    [Fact]
    public async Task CreateAsyncShouldDemotePreviousDefaultWhenIsDefaultIsTrue()
    {
        var first = await _service.GetOrCreateDefaultAsync();

        var created = await _service.CreateAsync("Second", null, isDefault: true,
            remoteTarget: null, remoteBaseUrl: null);

        Assert.True(created.IsSuccess);
        Assert.True(created.Value!.IsDefault);
        Assert.Equal(1, await _db.Projects.CountAsync(p => p.IsDefault));

        var refreshed = await _db.Projects.FindAsync(first.Id);
        Assert.False(refreshed!.IsDefault);
    }

    [Fact]
    public async Task UpdateAsyncShouldRejectUnsettingDefault()
    {
        var defaultProject = await _service.GetOrCreateDefaultAsync();

        var result = await _service.UpdateAsync(defaultProject.Id, defaultProject.Name, defaultProject.Color,
            isArchived: false, isDefault: false, remoteTarget: null, remoteBaseUrl: null);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task DeleteAsyncShouldRejectDeletingDefault()
    {
        var defaultProject = await _service.GetOrCreateDefaultAsync();

        var result = await _service.DeleteAsync(defaultProject.Id);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task CreateAsyncShouldRejectInvalidRemoteConfig()
    {
        var result = await _service.CreateAsync("Remote", null, isDefault: false,
            remoteTarget: RemoteTarget.Redmine, remoteBaseUrl: "not-a-url");

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task CreateAsyncShouldRejectDuplicateName()
    {
        await _service.CreateAsync("Alpha", null, false, null, null);
        var dup = await _service.CreateAsync("Alpha", null, false, null, null);

        Assert.True(dup.IsFailure);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }
}

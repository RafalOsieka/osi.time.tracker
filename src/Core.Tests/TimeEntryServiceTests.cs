using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Services;
using osi.time.tracker.Infrastructure.Persistence;
using Xunit;

namespace osi.time.tracker.Core.Tests;

public class TimeEntryServiceTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly TimeEntryService _service;
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Guid _itemId = Guid.NewGuid();

    public TimeEntryServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _db = new ApplicationDbContext(options);
        _service = new TimeEntryService(_db, TimeProvider.System);

        _db.Projects.Add(new Project
        {
            Id = _projectId,
            Name = "Test Project",
            IsDefault = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        _db.Items.Add(new Item
        {
            Id = _itemId,
            ProjectId = _projectId,
            Title = "Test Item",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        _db.SaveChanges();
    }

    [Fact]
    public async Task CreateAsyncShouldFailWhenOverlappingWithExisting()
    {
        // Existing: 10:00 - 11:00
        await _service.CreateAsync(_itemId, "Existing", new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 11, 0, 0, DateTimeKind.Utc));

        // New: 10:30 - 11:30 (Overlaps)
        var result = await _service.CreateAsync(_itemId, "Overlapping", new DateTime(2026, 1, 1, 10, 30, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 11, 30, 0, DateTimeKind.Utc));

        Assert.True(result.IsFailure);
        Assert.Equal("Time entry overlaps with an existing entry.", result.Error);
    }

    [Fact]
    public async Task CreateAsyncShouldSucceedWhenNoOverlap()
    {
        // Existing: 10:00 - 11:00
        await _service.CreateAsync(_itemId, "Existing", new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 11, 0, 0, DateTimeKind.Utc));

        // New: 11:00 - 12:00 (No overlap - exact touch is fine)
        var result = await _service.CreateAsync(_itemId, "No Overlap", new DateTime(2026, 1, 1, 11, 0, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc));

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task CreateAsyncShouldFailWhenOverlappingWithRunning()
    {
        // Existing: 10:00 - Running
        await _service.CreateAsync(_itemId, "Running", new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc), null);

        // New: 11:00 - 12:00 (Overlaps because running has no end)
        var result = await _service.CreateAsync(_itemId, "Overlapping", new DateTime(2026, 1, 1, 11, 0, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc));

        Assert.True(result.IsFailure);
    }

    [Fact]
    public void DatabaseSchemaShouldBeValid()
    {
        // This confirms that the model can be built and initialized without errors.
        // EF Core will throw if configurations (Fluent API) are invalid.
        Assert.NotNull(_db.Model);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }
}

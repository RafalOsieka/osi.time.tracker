using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Entities;

namespace osi.time.tracker.Core.Persistence;

public interface IAppDbContext
{
    DbSet<Project> Projects { get; }
    DbSet<Item> Items { get; }
    DbSet<TimeEntry> TimeEntries { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

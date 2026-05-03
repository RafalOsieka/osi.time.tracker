using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Entities;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Infrastructure.Persistence;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
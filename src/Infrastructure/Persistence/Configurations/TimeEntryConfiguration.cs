using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using osi.time.tracker.Core.Entities;

namespace osi.time.tracker.Infrastructure.Persistence.Configurations;

public class TimeEntryConfiguration : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Title).IsRequired();
        builder.Property(e => e.StartUtc).IsRequired();
        builder.Property(e => e.CreatedUtc).IsRequired();
        builder.Property(e => e.UpdatedUtc).IsRequired();
        builder.Property(e => e.Published).HasDefaultValue(false);

        builder.HasIndex(e => new { e.ProjectId, e.ItemId, e.StartUtc });

        builder.HasOne(e => e.Project)
            .WithMany(p => p.TimeEntries)
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Item)
            .WithMany(i => i.TimeEntries)
            .HasForeignKey(e => e.ItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(e => e.IsRunning);
    }
}

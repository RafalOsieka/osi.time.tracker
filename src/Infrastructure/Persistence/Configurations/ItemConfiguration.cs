using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using osi.time.tracker.Core.Entities;

namespace osi.time.tracker.Infrastructure.Persistence.Configurations;

public class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Title).IsRequired();
        builder.Property(i => i.IsArchived).HasDefaultValue(false);
        builder.Property(i => i.CreatedUtc).IsRequired();
        builder.Property(i => i.UpdatedUtc).IsRequired();

        // Within a project, a remote-mapped item is unique by its remote ID.
        builder.HasIndex(i => new { i.ProjectId, i.RemoteId }).IsUnique();

        builder.HasOne(i => i.Project)
            .WithMany(p => p.Items)
            .HasForeignKey(i => i.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
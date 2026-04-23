using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using osi.time.tracker.Core.Entities;

namespace osi.time.tracker.Infrastructure.Persistence.Configurations;

public class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Name).IsRequired();
        builder.Property(i => i.RemoteTarget).IsRequired();
        builder.Property(i => i.RemoteBaseUrl).IsRequired();
        builder.Property(i => i.RemoteId).IsRequired();
        builder.Property(i => i.IsArchived).HasDefaultValue(false);
        builder.Property(i => i.CreatedUtc).IsRequired();
        builder.Property(i => i.UpdatedUtc).IsRequired();

        builder.HasIndex(i => new { i.RemoteTarget, i.RemoteBaseUrl, i.RemoteId }).IsUnique();

        builder.HasOne(i => i.Project)
            .WithMany(p => p.Items)
            .HasForeignKey(i => i.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

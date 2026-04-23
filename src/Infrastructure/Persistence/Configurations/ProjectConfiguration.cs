using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using osi.time.tracker.Core.Entities;

namespace osi.time.tracker.Infrastructure.Persistence.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).IsRequired();
        builder.Property(p => p.IsArchived).HasDefaultValue(false);
        builder.Property(p => p.CreatedUtc).IsRequired();
        builder.Property(p => p.UpdatedUtc).IsRequired();
    }
}

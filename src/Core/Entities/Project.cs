namespace osi.time.tracker.Core.Entities;

public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
    public bool IsDefault { get; set; }
    public RemoteTarget? RemoteTarget { get; set; }
    public string? RemoteBaseUrl { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public bool IsRemote => RemoteTarget.HasValue;

    public ICollection<Item> Items { get; set; } = [];
}

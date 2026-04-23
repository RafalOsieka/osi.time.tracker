namespace osi.time.tracker.Core.Entities;

public class Item
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public RemoteTarget RemoteTarget { get; set; }
    public string RemoteBaseUrl { get; set; } = string.Empty;
    public string RemoteId { get; set; } = string.Empty;
    public bool IsArchived { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Project Project { get; set; } = null!;
    public ICollection<TimeEntry> TimeEntries { get; set; } = [];
}

namespace osi.time.tracker.Core.Entities;

public class TimeEntry
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid ItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime? EndUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public bool Published { get; set; }
    public DateTime? PublishedAtUtc { get; set; }
    public RemoteTarget? PublishedTo { get; set; }
    public string? PublishedRemoteId { get; set; }

    public Project Project { get; set; } = null!;
    public Item Item { get; set; } = null!;

    public bool IsRunning => EndUtc is null;
}

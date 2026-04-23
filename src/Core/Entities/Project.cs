namespace osi.time.tracker.Core.Entities;

public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public ICollection<Item> Items { get; set; } = [];
    public ICollection<TimeEntry> TimeEntries { get; set; } = [];
}

using Microsoft.EntityFrameworkCore;
using osi.time.tracker.Core.Persistence;

namespace osi.time.tracker.Core.Services;

public class ReportService(IAppDbContext db)
{
    public async Task<List<DailyReportDto>> GetDailyReportAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var entries = await db.TimeEntries
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null)
            .ToListAsync(ct);

        return entries
            .GroupBy(e => DateOnly.FromDateTime(e.StartUtc))
            .Select(g => new DailyReportDto
            {
                Date = g.Key,
                TotalSeconds = g.Sum(e => (e.EndUtc!.Value - e.StartUtc).TotalSeconds)
            })
            .OrderBy(r => r.Date)
            .ToList();
    }

    public async Task<List<ItemReportDto>> GetItemReportAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var entries = await db.TimeEntries
            .Include(e => e.Item)
            .Include(e => e.Project)
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null)
            .ToListAsync(ct);

        return entries
            .GroupBy(e => new { e.ItemId, e.Item.Name, ProjectName = e.Project.Name })
            .Select(g => new ItemReportDto
            {
                ItemId = g.Key.ItemId,
                ItemName = g.Key.Name,
                ProjectName = g.Key.ProjectName,
                TotalSeconds = g.Sum(e => (e.EndUtc!.Value - e.StartUtc).TotalSeconds)
            })
            .OrderBy(r => r.ProjectName)
            .ThenBy(r => r.ItemName)
            .ToList();
    }
}

public class DailyReportDto
{
    public DateOnly Date { get; init; }
    public double TotalSeconds { get; init; }
}

public class ItemReportDto
{
    public Guid ItemId { get; init; }
    public string ItemName { get; init; } = string.Empty;
    public string ProjectName { get; init; } = string.Empty;
    public double TotalSeconds { get; init; }
}

namespace osi.time.tracker.Core.Services;

public static class TimeRoundingService
{
    private const int RoundingStepMinutes = 15;

    /// <summary>
    /// Rounds total seconds to the nearest 15-minute increment (ties round up).
    /// Returns the rounded value as a TimeSpan.
    /// </summary>
    public static TimeSpan RoundToNearest15(double totalSeconds)
    {
        if (totalSeconds <= 0)
            return TimeSpan.Zero;

        var stepSeconds = RoundingStepMinutes * 60.0;
        var steps = totalSeconds / stepSeconds;

        // Nearest, ties up: use Math.Ceiling for exact halves, Math.Round otherwise.
        // MidpointRounding.AwayFromZero rounds 0.5 up for positive numbers.
        var rounded = Math.Round(steps, MidpointRounding.AwayFromZero);

        // Ensure at least one step if there was any time at all
        if (rounded == 0 && totalSeconds > 0)
            rounded = 1;

        return TimeSpan.FromMinutes(rounded * RoundingStepMinutes);
    }

    /// <summary>
    /// Rounds total seconds to the nearest 15-minute increment and returns decimal hours.
    /// Suitable for Redmine time entry format.
    /// </summary>
    public static decimal RoundToDecimalHours(double totalSeconds)
    {
        var rounded = RoundToNearest15(totalSeconds);
        return (decimal)rounded.TotalHours;
    }

    /// <summary>
    /// Rounds total seconds to the nearest 15-minute increment and returns ISO 8601 duration.
    /// Suitable for OpenProject time entry format (e.g., "PT2H30M").
    /// </summary>
    public static string RoundToIsoDuration(double totalSeconds)
    {
        var rounded = RoundToNearest15(totalSeconds);
        var hours = (int)rounded.TotalHours;
        var minutes = rounded.Minutes;

        if (hours > 0 && minutes > 0)
            return $"PT{hours}H{minutes}M";
        if (hours > 0)
            return $"PT{hours}H";
        return $"PT{minutes}M";
    }

    /// <summary>
    /// Groups time entries by (remoteId, spentOn date) and returns aggregated rounded totals.
    /// </summary>
    public static List<GroupedTime> GroupAndRound(
        IEnumerable<(string RemoteId, DateTime StartUtc, DateTime? EndUtc)> entries,
        TimeZoneInfo localTimeZone)
    {
        return entries
            .Where(e => e.EndUtc.HasValue)
            .GroupBy(e => (
                e.RemoteId,
                SpentOn: DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(e.StartUtc, localTimeZone))
            ))
            .Select(g =>
            {
                var totalSeconds = g.Sum(e => (e.EndUtc!.Value - e.StartUtc).TotalSeconds);
                return new GroupedTime
                {
                    RemoteId = g.Key.RemoteId,
                    SpentOn = g.Key.SpentOn,
                    RawSeconds = totalSeconds,
                    Rounded = RoundToNearest15(totalSeconds)
                };
            })
            .OrderBy(g => g.SpentOn)
            .ThenBy(g => g.RemoteId)
            .ToList();
    }
}

public class GroupedTime
{
    public string RemoteId { get; init; } = string.Empty;
    public DateOnly SpentOn { get; init; }
    public double RawSeconds { get; init; }
    public TimeSpan Rounded { get; init; }
    public decimal DecimalHours => (decimal)Rounded.TotalHours;
}

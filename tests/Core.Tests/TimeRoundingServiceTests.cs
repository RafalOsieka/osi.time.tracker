using osi.time.tracker.Core.Services;
using Xunit;

namespace Core.Tests;

public class TimeRoundingServiceTests
{
    [Theory]
    [InlineData(0, 0)] // 0 -> 0
    [InlineData(1, 15)] // 1s -> 15m (min 1 step rule)
    [InlineData(449, 15)] // 7m 29s -> 15m (min 1 step rule triggers)
    [InlineData(450, 15)] // 7m 30s -> 15m (tie up)
    [InlineData(900, 15)] // 15m -> 15m
    [InlineData(1349, 15)] // 22m 29s -> 15m
    [InlineData(1350, 30)] // 22m 30s -> 30m (tie up)
    [InlineData(3600, 60)] // 1h -> 1h
    public void RoundToNearest15ShouldRoundCorrectly(double inputSeconds, double expectedMinutes)
    {
        var result = TimeRoundingService.RoundToNearest15(inputSeconds);
        Assert.Equal(TimeSpan.FromMinutes(expectedMinutes), result);
    }

    [Fact]
    public void RoundToDecimalHoursShouldReturnCorrectValue()
    {
        // 45 minutes = 0.75 hours
        var result = TimeRoundingService.RoundToDecimalHours(2700);
        Assert.Equal(0.75m, result);
    }

    [Theory]
    [InlineData(2700, "PT45M")]
    [InlineData(3600, "PT1H")]
    [InlineData(5400, "PT1H30M")]
    public void RoundToIsoDurationShouldReturnCorrectFormat(double inputSeconds, string expected)
    {
        var result = TimeRoundingService.RoundToIsoDuration(inputSeconds);
        Assert.Equal(expected, result);
    }
}
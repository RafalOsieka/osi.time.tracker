using System.Net.Http.Json;
using System.Text.Json;
using osi.time.tracker.Core.Services;
using Xunit;

namespace Api.IntegrationTests;

[Collection("Api")]
public class ReportTests(ApiFixture fixture) : IAsyncLifetime
{
    public Task InitializeAsync()
    {
        return fixture.ResetDatabaseAsync();
    }

    public Task DisposeAsync()
    {
        return Task.CompletedTask;
    }

    private async Task<Guid> CreateProjectAsync()
    {
        var response = await fixture.HttpClient.PostAsJsonAsync("projects",
            new { name = "Report Project", color = (string?)null, isDefault = false });
        response.EnsureSuccessStatusCode();
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        return doc.GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateItemAsync(Guid projectId)
    {
        var response = await fixture.HttpClient.PostAsJsonAsync("items",
            new { projectId, title = "Report Item", remoteId = (string?)null });
        response.EnsureSuccessStatusCode();
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        return doc.GetProperty("id").GetGuid();
    }

    private async Task CreateEntryAsync(Guid itemId, DateTime start, DateTime end)
    {
        var response = await fixture.HttpClient.PostAsJsonAsync("entries",
            new { itemId, title = "Entry", startUtc = start, endUtc = end });
        response.EnsureSuccessStatusCode();
    }

    private async Task<double> GetTotalSecondsAsync(DateTime from, DateTime to)
    {
        var response = await fixture.HttpClient.GetAsync(
            $"reports/by-item?from={from:O}&to={to:O}");
        response.EnsureSuccessStatusCode();
        var items = await response.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(items);
        Assert.NotEmpty(items);
        return items[0].GetProperty("totalSeconds").GetDouble();
    }

    [Fact]
    public async Task RoundingDown_22Min_Returns15Min()
    {
        var projectId = await CreateProjectAsync();
        var itemId = await CreateItemAsync(projectId);
        var start = DateTime.UtcNow.Date.AddHours(8);
        var end = start.AddMinutes(22);
        await CreateEntryAsync(itemId, start, end);

        var totalSeconds = await GetTotalSecondsAsync(start.AddDays(-1), end.AddDays(1));

        var rounded = TimeRoundingService.RoundToNearest15(totalSeconds);
        Assert.Equal(TimeSpan.FromMinutes(15), rounded);
    }

    [Fact]
    public async Task TieRoundsUp_7Min30Sec_Returns15Min()
    {
        var projectId = await CreateProjectAsync();
        var itemId = await CreateItemAsync(projectId);
        var start = DateTime.UtcNow.Date.AddHours(9);
        var end = start.AddMinutes(7).AddSeconds(30);
        await CreateEntryAsync(itemId, start, end);

        var totalSeconds = await GetTotalSecondsAsync(start.AddDays(-1), end.AddDays(1));

        var rounded = TimeRoundingService.RoundToNearest15(totalSeconds);
        Assert.Equal(TimeSpan.FromMinutes(15), rounded);
    }

    [Fact]
    public async Task Minimum15Min_3Min_Returns15Min()
    {
        var projectId = await CreateProjectAsync();
        var itemId = await CreateItemAsync(projectId);
        var start = DateTime.UtcNow.Date.AddHours(10);
        var end = start.AddMinutes(3);
        await CreateEntryAsync(itemId, start, end);

        var totalSeconds = await GetTotalSecondsAsync(start.AddDays(-1), end.AddDays(1));

        var rounded = TimeRoundingService.RoundToNearest15(totalSeconds);
        Assert.Equal(TimeSpan.FromMinutes(15), rounded);
    }
}
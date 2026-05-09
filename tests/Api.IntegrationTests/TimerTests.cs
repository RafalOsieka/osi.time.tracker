using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Api.IntegrationTests;

[Collection("Api")]
public class TimerTests(ApiFixture fixture) : IAsyncLifetime
{
    public Task InitializeAsync()
    {
        return fixture.ResetDatabaseAsync();
    }

    public Task DisposeAsync()
    {
        return Task.CompletedTask;
    }

    [Fact]
    public async Task GetActive_ReturnsNotFound_WhenNoTimerRunning()
    {
        var response = await fixture.HttpClient.GetAsync("timer/active");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task StartTimer_PersistsTimer_AndGetActiveReturns200()
    {
        var startResponse = await fixture.HttpClient.PostAsJsonAsync("timer/start",
            new { itemId = (Guid?)null, title = "Test timer" });

        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var activeResponse = await fixture.HttpClient.GetAsync("timer/active");
        Assert.Equal(HttpStatusCode.OK, activeResponse.StatusCode);
    }

    [Fact]
    public async Task StopTimer_CreatesEntry_AndGetActiveReturns404()
    {
        await fixture.HttpClient.PostAsJsonAsync("timer/start",
            new { itemId = (Guid?)null, title = "Test timer" });

        var stopResponse = await fixture.HttpClient.PostAsync("timer/stop", null);
        Assert.Equal(HttpStatusCode.OK, stopResponse.StatusCode);

        var activeResponse = await fixture.HttpClient.GetAsync("timer/active");
        Assert.Equal(HttpStatusCode.NotFound, activeResponse.StatusCode);
    }
}
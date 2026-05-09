using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Api.IntegrationTests;

[Collection("Api")]
public class EntryTests(ApiFixture fixture) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

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
            new { name = "Test Project", color = (string?)null, isDefault = false });
        response.EnsureSuccessStatusCode();
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        return doc.GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateItemAsync(Guid projectId)
    {
        var response = await fixture.HttpClient.PostAsJsonAsync("items",
            new { projectId, title = "Test Item", remoteId = (string?)null });
        response.EnsureSuccessStatusCode();
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        return doc.GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task CreateEntry_ReturnsOk_AndPersistsEntry()
    {
        var projectId = await CreateProjectAsync();
        var itemId = await CreateItemAsync(projectId);
        var start = DateTime.UtcNow.AddHours(-1);
        var end = DateTime.UtcNow;

        var createResponse = await fixture.HttpClient.PostAsJsonAsync("entries",
            new { itemId, title = "Test Entry", startUtc = start, endUtc = end });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync(
            $"entries?from={start.AddDays(-1):O}&to={end.AddDays(1):O}");
        listResponse.EnsureSuccessStatusCode();
        var entries = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(entries);
        Assert.Contains(entries, e => e.GetProperty("title").GetString() == "Test Entry");
    }

    [Fact]
    public async Task UpdateEntry_ReturnsOk_AndPersistsChanges()
    {
        var projectId = await CreateProjectAsync();
        var itemId = await CreateItemAsync(projectId);
        var start = DateTime.UtcNow.AddHours(-1);
        var end = DateTime.UtcNow;

        var createResponse = await fixture.HttpClient.PostAsJsonAsync("entries",
            new { itemId, title = "Original", startUtc = start, endUtc = end });
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        var updateResponse = await fixture.HttpClient.PutAsJsonAsync($"entries/{id}",
            new { title = "Updated", startUtc = start, endUtc = end });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync(
            $"entries?from={start.AddDays(-1):O}&to={end.AddDays(1):O}");
        listResponse.EnsureSuccessStatusCode();
        var entries = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(entries);
        Assert.Contains(entries, e => e.GetProperty("title").GetString() == "Updated");
    }

    [Fact]
    public async Task DeleteEntry_ReturnsNoContent_AndRemovesEntry()
    {
        var projectId = await CreateProjectAsync();
        var itemId = await CreateItemAsync(projectId);
        var start = DateTime.UtcNow.AddHours(-1);
        var end = DateTime.UtcNow;

        var createResponse = await fixture.HttpClient.PostAsJsonAsync("entries",
            new { itemId, title = "To Delete", startUtc = start, endUtc = end });
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        var deleteResponse = await fixture.HttpClient.DeleteAsync($"entries/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync(
            $"entries?from={start.AddDays(-1):O}&to={end.AddDays(1):O}");
        listResponse.EnsureSuccessStatusCode();
        var entries = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(entries);
        Assert.DoesNotContain(entries, e => e.GetProperty("id").GetGuid() == id);
    }
}
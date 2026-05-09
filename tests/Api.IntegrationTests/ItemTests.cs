using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Api.IntegrationTests;

[Collection("Api")]
public class ItemTests(ApiFixture fixture) : IAsyncLifetime
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
            new { name = "Test Project", color = (string?)null, isDefault = false });
        response.EnsureSuccessStatusCode();
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        return doc.GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task CreateItem_ReturnsOk_AndPersistsItem()
    {
        var projectId = await CreateProjectAsync();

        var createResponse = await fixture.HttpClient.PostAsJsonAsync("items",
            new { projectId, title = "Test Item", remoteId = (string?)null });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync("items");
        listResponse.EnsureSuccessStatusCode();
        var items = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(items);
        Assert.Contains(items, i => i.GetProperty("title").GetString() == "Test Item");
    }

    [Fact]
    public async Task DeleteItem_ReturnsNoContent_AndRemovesItem()
    {
        var projectId = await CreateProjectAsync();

        var createResponse = await fixture.HttpClient.PostAsJsonAsync("items",
            new { projectId, title = "To Delete", remoteId = (string?)null });
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        var deleteResponse = await fixture.HttpClient.DeleteAsync($"items/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync("items");
        listResponse.EnsureSuccessStatusCode();
        var items = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(items);
        Assert.DoesNotContain(items, i => i.GetProperty("id").GetGuid() == id);
    }
}
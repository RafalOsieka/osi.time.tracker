using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Api.IntegrationTests;

[Collection("Api")]
public class ProjectTests(ApiFixture fixture) : IAsyncLifetime
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
    public async Task CreateProject_ReturnsOk_AndPersistsProject()
    {
        var createResponse = await fixture.HttpClient.PostAsJsonAsync("projects",
            new { name = "My Project", color = "#ff0000", isDefault = false });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync("projects");
        listResponse.EnsureSuccessStatusCode();
        var projects = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(projects);
        Assert.Contains(projects, p => p.GetProperty("name").GetString() == "My Project");
    }

    [Fact]
    public async Task DeleteProject_ReturnsNoContent_AndRemovesProject()
    {
        var createResponse = await fixture.HttpClient.PostAsJsonAsync("projects",
            new { name = "To Delete", color = (string?)null, isDefault = false });
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        var deleteResponse = await fixture.HttpClient.DeleteAsync($"projects/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var listResponse = await fixture.HttpClient.GetAsync("projects");
        listResponse.EnsureSuccessStatusCode();
        var projects = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(projects);
        Assert.DoesNotContain(projects, p => p.GetProperty("id").GetGuid() == id);
    }
}
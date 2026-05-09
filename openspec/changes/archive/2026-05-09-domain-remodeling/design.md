# Design: Domain Remodeling

## Data Model Updates

### Project Entity
```csharp
public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public bool IsDefault { get; set; } // Only one project can be true
    public bool IsRemote => RemoteTarget.HasValue;
    public RemoteTarget? RemoteTarget { get; set; } // Redmine, OpenProject, etc.
    public string? RemoteBaseUrl { get; set; }
    // ... existing fields (Color, IsArchived, Timestamps)
}
```

### Item Entity
```csharp
public class Item
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Title { get; set; } // Cached remote title or TimeEntry title
    public string? RemoteId { get; set; } // e.g. "123" for Redmine issue
    // ... existing fields (IsArchived, Timestamps)
}
```

### TimeEntry Entity
```csharp
public class TimeEntry
{
    public Guid Id { get; set; }
    public Guid ItemId { get; set; }
    public string Title { get; set; } // The specific task description
    public DateTime StartUtc { get; set; }
    public DateTime? EndUtc { get; set; }
    // ... remove Note field
}
```

## Logic Flows

### 1. Timer Start (Implicit Item Creation)
If no item is selected:
1. Create a new `Item` under the **Default Project**.
2. Set `Item.Title` = `TimeEntry.Title`.
3. Start the `TimeEntry`.

### 2. Title Synchronization
- **Local -> Remote**: When an `Item` is matched with a remote ID, the `Item.Title` is overwritten with the issue title fetched from the remote API.
- **Local Update**: Users can manually rename the `Item.Title` for local projects.

### 3. Token Management (Client-Side)
Tokens are stored in `localStorage` using a key pattern: `osi_token_{projectId}`.
The UI Settings page will provide a management interface to set/clear tokens per project.

### 4. Item Merging / Moving
- Users can move a `TimeEntry` to a different `Item`.
- Moving all entries from Item A to Item B effectively merges them; Item A can then be deleted/archived.
- Changing an `Item`'s `ProjectId` allows moving work between local and remote systems.

## API Changes
- `POST /api/projects`: Handle `IsDefault` and remote config.
- `PATCH /api/items/{id}/match`: Associate with remote ID and update title.
- `GET /api/settings/tokens`: (Frontend only) List projects requiring tokens.

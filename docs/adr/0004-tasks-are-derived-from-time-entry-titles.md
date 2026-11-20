# Tasks are derived from Time entry titles

The user never creates or deletes a Task. A Time entry's title is resolved on the server to the Task with that name in the same Project and with the same Remote issue, creating it when none exists. A Task is unique per user, Project, name and Remote issue, with a missing Project or issue counting as one value (`UNIQUE NULLS NOT DISTINCT`). Renaming a Task onto an existing one merges them, and a Task left without Time entries is hard-deleted in the same transaction. Linking a Task to a Remote issue for a day moves that day's Time entries to the Task carrying the issue.

Making the Remote issue part of the Task's identity is the surprising part. A separate one-to-one link table existed and was removed: it made a Task's issue global, so linking one day relinked every other day, and merging Tasks needed rules for conflicting links. Storing the issue on each Time entry was rejected because the Task, not the entry, is what gets exported. Soft-deleting Tasks was rejected because a hidden Task still holds its name and blocks titles from converging.

## Consequences

- The same name can exist as several Tasks with different Remote issues. A new Time entry's bare title binds to the most recently used of them, so the quick path of typing a title and pressing Enter never stops to ask; retitling an existing entry keeps its Remote issue.
- Task operations (rename, move, link, unlink) are moves of Time entries between Tasks followed by garbage collection, never edits of a Task's identity in place.
- Export records point at a Task and outlive its deletion.

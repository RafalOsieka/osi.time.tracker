# A Remote project scope covers the whole subtree

A Project's Remote project scope is a single Remote project, and it always includes all of that project's subprojects. Whether an issue lies in scope is answered by the Tracker, through a scoped search, never by comparing project ids in the browser. The server stores the scope as an opaque id with a cached title and never checks it against the Tracker.

A list of projects, exclusion rules and "this project without its subprojects" were rejected: a user who picks a parent wants the tree, a leaf is a tree of one, and both trackers make a single root cheap to query. Loading the project catalog to check membership in the browser was rejected because it costs an extra fetch on every search and duplicates the Tracker's own hierarchy logic.

## Consequences

- Every adapter must make scoped searches cover the subtree (for Redmine, `subproject_id=*`), whatever the instance's own setting.
- Import routes a Remote log to the Project scoped to its Remote project or to the nearest scoped ancestor, so a narrower scope wins.

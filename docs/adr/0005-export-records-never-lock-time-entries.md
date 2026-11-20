# Export records never lock Time entries

Export sends one Task's whole day as one Remote log, and the server stores an Export record of it. A Task's day with any Export record is Sent and is not exported again from Remote Sync, but nothing is locked: its Time entries and the Task can still be edited, moved or deleted, and the Tracker is left as it is. Deleting a Matched remote log removes it from the Tracker first and its Export record after.

Repeat safety comes from identity rather than state. A Remote log is identified by its Tracker and its id in that Tracker, unique per user, so Import and matching an Unmatched remote log can run again without creating duplicates and need no job table. Each Export carries a key the browser computes from the Task, the day, the covered Time entries and the duration; retrying after an uncertain finish reconciles with the stored record instead of creating a second Remote log. An attempt whose Remote log id never reached the browser is reported as needing a check in the Tracker and is never reconciled automatically.

Rejected: a lock or "pushed" flag on Time entries (it would turn a record of what was sent into a rule about what may change), exporting single Time entries (more states for an end-of-day task, and it existed before the Task's day became the unit), a durable export queue (a day has a handful of Tasks and the user is watching), letting the server query the Tracker for recent logs (it holds no API key, see ADR-0001), and matching Remote logs by duration or comment (unreliable).

## Consequences

- Local history and the Tracker can drift apart after an export; Remote Sync and the Monthly timesheet show the difference instead of preventing it.
- A Remote log id is only unique within its Tracker, so every lookup and constraint uses the pair, never the id alone.

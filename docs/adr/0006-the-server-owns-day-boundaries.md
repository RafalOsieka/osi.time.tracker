# The server owns day boundaries

Times travel as UTC instants, and every user has a required IANA timezone stored on their account. Wherever a day matters (the Timer view's feed, Remote Sync, the Monthly timesheet) the server cuts days in that stored timezone, and the session carries it so the first render and the browser agree.

The first version left the server timezone-free and grouped days in the browser's own zone; once a stored timezone existed, the server took over cutting days so server rendering, paging by days and reports use the same boundaries. A timezone sent by the client with each request was rejected because it would let the client choose which entries fall into a day. Detecting the browser's zone as a fallback was removed once the timezone became required.

## Consequences

- Changing the timezone only re-renders; no stored time changes.
- There is no browser default and no week-start setting.

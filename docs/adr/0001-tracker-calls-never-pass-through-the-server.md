# Tracker calls never pass through the server

Every call to a Tracker runs in the user's browser: straight from the Time Tracker App when the Tracker allows Direct browser access, otherwise through the Browser extension. The API key lives only in the browser's `localStorage` and never reaches the server, so the server holds nothing that can read from or write to a Tracker, and it never calls one.

A server proxy for Trackers that block cross-origin requests existed once and was removed: it forwarded API keys through the server and needed one fixed route per operation to stay clear of SSRF, while the Browser extension serves the same Trackers from the user's own browser. Storing API keys on the server, encrypted or not, is rejected for the same reason.

## Consequences

- Everything that needs Tracker data runs in the browser: Export, routing an Import to Projects, the Monthly timesheet's remote hours and the Client report PDF. The server records what the browser reports (Export records, imported Time entries) after checking ownership and shape, without asking the Tracker.
- Remote calls happen only when the user acts. There is no background sync, polling or scheduled job against a Tracker, because nothing can reach one without the browser.
- The API key is stored as plaintext. Same-origin JavaScript could use it however it was stored, so CSP is the defence against XSS, not encryption.
- An API key belongs to one browser: a new device, or a browser whose storage was cleared, needs it entered again.

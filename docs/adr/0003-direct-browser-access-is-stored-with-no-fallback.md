# Direct browser access is a stored Tracker setting, with no fallback

Each Tracker stores whether the browser may call it directly. When it may, every call goes straight from the Time Tracker App; when it may not, every call goes through the Browser extension. The app never switches between the two at run time: no preferring the extension when it is installed, and no retrying the other way after a failure.

A browser cannot tell a CORS rejection apart from other network failures, so an automatic fallback would guess, and replaying a create that may have reached the Tracker can leave a duplicate Remote log. Detecting the device (for example hiding the extension option on mobile) was rejected too: the setting belongs to the Tracker, which every device shares, and user-agent detection is unreliable.

## Consequences

- A Tracker set to need the extension cannot be used on a device without it; the operation fails with an error that says what to install or approve, and local time tracking keeps working.
- Extension readiness is shown in one place, the sidebar status, rather than being probed by every remote control.

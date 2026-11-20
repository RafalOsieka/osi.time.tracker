# The Browser extension runs named operations, not a network relay

The Browser extension bundles the same provider adapters as the Time Tracker App and exposes only their named operations (search issues, fetch Remote logs, create a Remote log and so on) over a validated, versioned protocol. The page reaches it through a content script and a `MessagePort`. The extension acts only for a Time Tracker App and a Tracker URL the user approved in its own UI, builds every request itself, follows no redirects and sends no cookies. The API key passes through it for one request and is never stored there.

A plain HTTP relay would have been smaller, but it hands any approved page a general network primitive that is hard to authorise. `externally_connectable` was rejected because it fixes the allowed origins at build time, which does not work for an installation at its own address or for an unpacked build. Trusting browser host permissions alone was rejected because they do not bind one Time Tracker App to one Tracker URL.

## Consequences

- A new kind of Tracker call means a new operation in the protocol and in the extension, not just a new URL.
- The Time Tracker App and the extension must speak the same protocol version exactly; a change to an operation's shape bumps the version and an outdated side fails the handshake. Both are built from this repository, so they ship together and there is no compatibility layer.
- Work that needs the API key, such as resolving issue titles, runs inside the extension so the key does not cross the bridge twice.

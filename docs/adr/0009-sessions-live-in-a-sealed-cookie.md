# Sessions live in a sealed cookie

A session is a sealed, fixed-lifetime cookie (`nuxt-auth-utils`) holding the user's id, email, display name and settings. There is no session table. Mutating requests also need a CSRF token, and the cookie is `SameSite=Lax`, so top-level navigations into the app keep the session while the token protects writes.

A database session table was rejected for now: it would allow revoking sessions on other devices, but no feature needs that yet, and logging out already clears the cookie. Hand-written cookies were rejected as more code that is easier to get wrong.

## Consequences

- Sessions on other devices cannot be revoked one by one; rotating the session password ends every session at once.
- Data a page needs on first paint, such as the timezone, rides in the session and is refreshed when it changes.

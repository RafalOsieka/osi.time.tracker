## ADDED Requirements

### Requirement: REQ-267 SVG-first brand mark and favicon
The application SHALL provide an original brand mark as scalable vector graphics, distinct from any third-party framework default icon. The mark SHALL be a circular clock ring with a single hand and a hub, without letterforms, tick marks, or a play triangle, so it remains legible at favicon size (~16×16) and at sidebar size (~24px).

In application chrome (sidebar brand region and auth-layout heading) the mark SHALL be a background-free glyph that inherits the configured brand `primary` color (REQ-160) so its effective shade adapts between light and dark mode. The document favicon SHALL be a colored rounded-square app icon with a white glyph on a cyan fill matching the brand ramp. Because a tab icon cannot inherit CSS color tokens, that fill MAY be a static color in the favicon asset; in-app chrome SHALL NOT use a raw hex class to tint the glyph.

The document head SHALL advertise the app icon as the favicon (SVG plus a raster `.ico` fallback). The previous third-party default favicon SHALL NOT remain the tab icon.

This requirement does not add a PWA manifest, service worker, or additional raster sizes (apple-touch, 192/512, maskable). Those remain a later PWA change; the SVG app icon SHALL remain the source for those sizes.

#### Scenario: In-chrome mark follows the brand accent
- **WHEN** the brand mark is rendered in the sidebar or on the login heading in light or dark mode
- **THEN** its color SHALL derive from the configured `primary` token rather than a hardcoded hex class

#### Scenario: Favicon is the app icon, not a framework default
- **WHEN** a browser loads any application page
- **THEN** the document favicon SHALL be the application brand app icon (SVG and `.ico` fallback) and SHALL NOT be a third-party framework default

#### Scenario: Mark has no letterforms
- **WHEN** the brand mark or favicon is rendered
- **THEN** it SHALL not contain readable letters (including a short brand abbreviation)

#### Scenario: Dark mode does not invert the favicon fill
- **WHEN** the user is in dark mode
- **THEN** the favicon SHALL remain the cyan rounded-square app icon with a white glyph (the in-chrome glyph still follows `primary`)

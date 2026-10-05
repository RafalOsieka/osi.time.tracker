## MODIFIED Requirements

### Requirement: REQ-368 SVG-first brand mark and favicon
The application SHALL provide an original brand mark as scalable vector graphics, distinct from any third-party framework default icon. The mark SHALL be built from constructed geometry — circular arcs, straight segments, and filled polygons placed on a declared grid — and SHALL NOT embed outlines traced from a typeface. The mark SHALL be an **open dial** enclosing a single-letter monogram, and SHALL remain legible at favicon size (~16×16) and at sidebar size (~24px).

The open dial SHALL be one continuous stroke that leaves exactly one quadrant of the circle open: it starts as a short straight bar at the 6 o'clock position, joins the circle tangentially, runs clockwise through 9 and 12, and ends at 3 o'clock. The 3-to-6 quadrant SHALL contain no dial stroke, so the dial reads as a clock face with time elapsed rather than a closed ring.

The monogram SHALL be the single letter "T" constructed from strokes and filled polygons rather than set in a font: a crossbar drawn heavier than the dial stroke, and a stem that tapers toward its end like a clock hand pointing at 6 o'clock. Type traced at 16×16 loses its stroke modulation and terminals; a letter constructed from a few heavy strokes has neither problem. The mark SHALL NOT contain a lattice of grid points or other decoration finer than the dial stroke. Readable words, brand abbreviations of more than one character, and a play triangle SHALL NOT appear in the mark.

In application chrome (sidebar brand region, auth-layout heading, and the browser extension's popup and options headers) the mark SHALL be a background-free glyph that inherits the configured brand `primary` color (REQ-160) so its effective shade adapts between light and dark mode. The in-app mark SHALL express its entire drawing through a single inherited color; it SHALL NOT use a raw hex class and SHALL NOT tint any part of the glyph to convey state.

The document favicon SHALL be a colored rounded-square app icon with a white glyph on a fill matching the brand ramp. Because a tab icon cannot inherit CSS color tokens, that fill MAY be a static color in the favicon asset.

The app-icon assets SHALL be separated by destination:

- The **maskable source** tile SHALL keep the drawn mark inside the central 80% safe circle **with margin to spare**, so that a future adaptive or maskable raster can be cut from it without redrawing and without looking cramped once the platform crops it.
- The **tab icon** tile SHALL scale the same glyph up (to ~88% of the canvas) to maximize legibility at 16×16, and SHALL be the asset used for the browser tab and its raster fallback.

Both tiles SHALL be generated from the same canonical glyph geometry so the two drawings cannot drift apart.

Every other rendering of the app icon, including the mark printed in generated documents such as the client report PDF title page (tracking-client-report), SHALL be derived from that same canonical glyph at build or render time rather than kept as a separate hand-copied drawing, so a change to the glyph reaches every copy without editing it. The browser extension is the one exception: it is built separately from the application, so it keeps its own copy of the glyph and a raster icon set cut once from the tab-icon tile (see below).

The document head SHALL advertise the app icon as the favicon (SVG plus a raster `.ico` fallback). A third-party framework default favicon SHALL NOT be the tab icon.

The browser extension SHALL keep a copy of the canonical glyph for its page headers, and a committed raster icon set (16, 32, 48 and 128 px) rasterized from the tab-icon tile. Both are derived assets, in the same way as the favicon tiles. The canonical glyph file SHALL list them among the assets to regenerate, and each extension copy SHALL name the canonical file it was derived from. Apart from that set, this requirement does not add a PWA manifest, service worker, or additional raster sizes (apple-touch, 192/512, maskable). Those remain a later PWA change; the maskable-source SVG app icon SHALL remain the source for those sizes.

#### Scenario: In-chrome mark follows the brand accent
- **WHEN** the brand mark is rendered in the sidebar or on the login heading in light or dark mode
- **THEN** its color SHALL derive from the configured `primary` token rather than a hardcoded hex class

#### Scenario: Favicon is the app icon, not a framework default
- **WHEN** a browser loads any application page
- **THEN** the document favicon SHALL be the application brand app icon (SVG and `.ico` fallback) and SHALL NOT be a third-party framework default

#### Scenario: Mark is constructed, not typeset
- **WHEN** the brand mark or favicon is rendered
- **THEN** every drawn element SHALL come from the mark's declared geometry and SHALL NOT be an outline traced from a typeface, and no readable word or multi-character abbreviation SHALL appear

#### Scenario: Dial is open in one quadrant
- **WHEN** the brand mark is rendered at any size
- **THEN** the dial stroke SHALL run from the bar at 6 o'clock clockwise to 3 o'clock, and the quadrant between 3 and 6 o'clock SHALL be free of dial stroke

#### Scenario: Monogram is a single constructed T
- **WHEN** the brand mark is inspected
- **THEN** its monogram SHALL be one letter "T" whose crossbar is heavier than the dial stroke and whose stem tapers toward 6 o'clock, and the mark SHALL contain no lattice points

#### Scenario: Mark survives the favicon size
- **WHEN** the tab icon is rasterized at 16×16
- **THEN** the open dial, including its open quadrant, and the "T" monogram SHALL both remain distinguishable

#### Scenario: Maskable source keeps its safe zone
- **WHEN** the maskable-source app icon is cropped to the circular safe area used by adaptive icons
- **THEN** no part of the glyph SHALL be clipped, and the mark SHALL still show visible margin inside that circle rather than meeting its edge

#### Scenario: Tab icon is scaled for legibility, not for masking
- **WHEN** the tab-icon tile is authored
- **THEN** its glyph SHALL be enlarged relative to the maskable source so the mark reads at 16×16, and that tile SHALL NOT be used as the source for adaptive or maskable rasters even where it would also satisfy the safe circle

#### Scenario: The two tiles share one geometry
- **WHEN** the glyph geometry changes
- **THEN** the maskable-source tile and the tab-icon tile SHALL both be regenerated from it, differing only in the glyph's scale within the canvas

#### Scenario: Generated documents use the current mark
- **WHEN** a client report PDF is generated
- **THEN** the mark on its title page SHALL be drawn from the canonical glyph, so it matches the in-app mark and favicon rather than an earlier version of the drawing

#### Scenario: Dark mode does not invert the favicon fill
- **WHEN** the user is in dark mode
- **THEN** the favicon SHALL remain the rounded-square app icon with a white glyph on the brand fill (the in-chrome glyph still follows `primary`)

#### Scenario: Extension copies are traceable to the glyph
- **WHEN** the canonical glyph file is inspected
- **THEN** its list of derived assets SHALL include the extension's glyph copy and its four PNG icons, and each of those copies SHALL reference the canonical file as its source

#### Scenario: A glyph change regenerates the extension copies
- **WHEN** the canonical glyph geometry changes
- **THEN** the same change SHALL update the extension's glyph copy and re-cut its four PNG icons from the updated tab-icon tile

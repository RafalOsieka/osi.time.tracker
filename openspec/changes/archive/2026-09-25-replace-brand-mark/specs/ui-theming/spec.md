## ADDED Requirements

### Requirement: REQ-368 SVG-first brand mark and favicon
The application SHALL provide an original brand mark as scalable vector graphics, distinct from any third-party framework default icon. The mark SHALL be built from constructed geometry — circles, rectangles, circular arcs, and straight segments placed on a declared grid — and SHALL NOT embed outlines traced from a typeface. The mark SHALL be a circular dial enclosing a monogram and a sparse lattice of grid points, and SHALL remain legible at favicon size (~16×16) and at sidebar size (~24px).

A monogram is permitted where it is assembled from the mark's own grid cells rather than set in a font. Type traced at 16×16 loses its stroke modulation and terminals, which is what made the earlier font-derived letter illegible at that size; a monogram built from the same cells as the surrounding lattice has neither. Readable words, brand abbreviations of more than one character, and a play triangle SHALL NOT appear in the mark.

In application chrome (sidebar brand region and auth-layout heading) the mark SHALL be a background-free glyph that inherits the configured brand `primary` color (REQ-160) so its effective shade adapts between light and dark mode. The in-app mark SHALL express its entire drawing through a single inherited color; it SHALL NOT use a raw hex class and SHALL NOT tint any part of the glyph to convey state.

The document favicon SHALL be a colored rounded-square app icon with a white glyph on a fill matching the brand ramp. Because a tab icon cannot inherit CSS color tokens, that fill MAY be a static color in the favicon asset.

The app-icon assets SHALL be separated by destination:

- The **maskable source** tile SHALL keep the drawn mark inside the central 80% safe circle **with margin to spare**, so that a future adaptive or maskable raster can be cut from it without redrawing and without looking cramped once the platform crops it.
- The **tab icon** tile SHALL scale the same glyph up (to ~88% of the canvas) to maximize legibility at 16×16, and SHALL be the asset used for the browser tab and its raster fallback.

Both tiles SHALL be generated from the same canonical glyph geometry so the two drawings cannot drift apart.

The document head SHALL advertise the app icon as the favicon (SVG plus a raster `.ico` fallback). A third-party framework default favicon SHALL NOT be the tab icon.

This requirement does not add a PWA manifest, service worker, or additional raster sizes (apple-touch, 192/512, maskable). Those remain a later PWA change; the maskable-source SVG app icon SHALL remain the source for those sizes.

#### Scenario: In-chrome mark follows the brand accent
- **WHEN** the brand mark is rendered in the sidebar or on the login heading in light or dark mode
- **THEN** its color SHALL derive from the configured `primary` token rather than a hardcoded hex class

#### Scenario: Favicon is the app icon, not a framework default
- **WHEN** a browser loads any application page
- **THEN** the document favicon SHALL be the application brand app icon (SVG and `.ico` fallback) and SHALL NOT be a third-party framework default

#### Scenario: Mark is constructed, not typeset
- **WHEN** the brand mark or favicon is rendered
- **THEN** every drawn element SHALL come from the mark's declared geometry and SHALL NOT be an outline traced from a typeface, and no readable word or multi-character abbreviation SHALL appear

#### Scenario: Mark survives the favicon size
- **WHEN** the tab icon is rasterized at 16×16
- **THEN** the dial and the monogram SHALL both remain distinguishable, even where the finest lattice points fall below one device pixel and render as tone rather than discrete dots

#### Scenario: Maskable source keeps its safe zone
- **WHEN** the maskable-source app icon is cropped to the circular safe area used by adaptive icons
- **THEN** no part of the glyph SHALL be clipped, and the mark SHALL still show visible margin inside that circle rather than meeting its edge

#### Scenario: Tab icon is scaled for legibility, not for masking
- **WHEN** the tab-icon tile is authored
- **THEN** its glyph SHALL be enlarged relative to the maskable source so the mark reads at 16×16, and that tile SHALL NOT be used as the source for adaptive or maskable rasters even where it would also satisfy the safe circle

#### Scenario: The two tiles share one geometry
- **WHEN** the glyph geometry changes
- **THEN** the maskable-source tile and the tab-icon tile SHALL both be regenerated from it, differing only in the glyph's scale within the canvas

#### Scenario: Dark mode does not invert the favicon fill
- **WHEN** the user is in dark mode
- **THEN** the favicon SHALL remain the rounded-square app icon with a white glyph on the brand fill (the in-chrome glyph still follows `primary`)

### Requirement: REQ-369 Favicon reflects idle vs running timer
The document favicon SHALL follow the shared running-timer state (the same `running` entry used by the shell widget, REQ-146 / REQ-258). When there is no running entry (including unauthenticated visits and an authenticated idle timer), the favicon SHALL be the default brand app icon from REQ-368. When a running entry is present, the favicon SHALL be a **static** variant of that same app icon in which the **tile fill changes from the brand cyan to a status green** while the glyph, its geometry, and its white color stay identical. The running variant SHALL NOT add a badge, dot, ring, or any other extra element, SHALL NOT pulse or animate, and SHALL NOT replace the brand glyph with a play control.

The signal SHALL be carried by the tile fill rather than by a corner badge, because at 16×16 a badge occupies a small fraction of the icon and is not reliably noticed in a crowded tab strip, whereas a fill change alters the entire icon while leaving the mark recognizable. The running fill SHALL provide at least as much contrast against the white glyph as the idle fill does, so the mark does not become harder to read in the running state.

The running variant SHALL apply as soon as running state is known, including first paint of an authenticated page whose SSR seed already contains a running entry. Stopping the timer, or otherwise clearing the running entry, SHALL restore the default favicon in that tab. Other open tabs are not required to update until they next resolve running state. The in-app brand mark (sidebar and login heading) SHALL remain the unmodified glyph and SHALL NOT signal running state by color or by any added element.

#### Scenario: Idle and logged-out use the default favicon
- **WHEN** there is no running entry (logged-out visitor, or authenticated user with an idle timer)
- **THEN** the document favicon SHALL be the default brand app icon on the cyan fill

#### Scenario: Running entry turns the tile green
- **WHEN** the authenticated user has a running entry
- **THEN** the document favicon SHALL be the same brand app icon with a green tile fill and an unchanged white glyph

#### Scenario: Running variant adds no elements
- **WHEN** the running favicon is rendered
- **THEN** it SHALL contain exactly the elements of the idle icon, with no status dot, ring, or badge, and SHALL NOT animate

#### Scenario: Running fill keeps the glyph readable
- **WHEN** the running tile is compared with the idle tile
- **THEN** the contrast ratio between the white glyph and the running fill SHALL be no lower than that of the white glyph against the idle fill

#### Scenario: Stop restores the default favicon
- **WHEN** the user stops the running timer in that tab
- **THEN** the document favicon SHALL return to the default brand app icon

#### Scenario: Reloading a running timer shows the running favicon on first paint
- **WHEN** an authenticated user with a running entry performs a full document load
- **THEN** the initial document favicon SHALL be the running (green-tile) variant rather than flashing the idle icon until a client-only fetch

#### Scenario: In-app mark is not tinted
- **WHEN** a timer is running
- **THEN** the sidebar and login brand mark SHALL remain the unmodified glyph in the `primary` color, with no green element and no added shape

## REMOVED Requirements

### Requirement: REQ-267 SVG-first brand mark and favicon
**Reason**: The requirement mandated "a circular clock ring with a single hand and a hub, without letterforms, tick marks, or a play triangle" — a drawing the product has never shipped. The asset committed in the original change was an arc plus a letterform traced from a font, so the requirement has described an imaginary mark since its introduction. Two of its clauses (the hand-and-hub geometry, and the blanket ban on letterforms) also directly contradict the mark this change adopts, so the requirement cannot be amended into truth; it is replaced wholesale by REQ-368.

**Migration**: REQ-368 carries forward every clause that still holds — the `currentColor` in-chrome glyph, the static-fill favicon exception, the SVG + `.ico` head advertisement, and the PWA non-goal — and replaces the geometry clause with constructed-geometry rules plus the maskable-source / tab-icon split. Code comments and specs referencing REQ-267 SHALL point at REQ-368.

### Requirement: REQ-268 Favicon reflects idle vs running timer
**Reason**: The requirement specified the running signal as "a green status dot in the bottom-right corner and a contrasting ring". That mechanism is being replaced by a full tile-fill change, which inverts two of its scenarios rather than refining them.

**Migration**: REQ-369 keeps the same state source (REQ-146 / REQ-258), the same static-only constraint, the same first-paint and stop-restores behavior, and the same rule that the in-app mark is never badged. Only the visual mechanism changes: `public/favicon-running.svg` drops its badge circle and changes its tile fill instead. The head-link contract (`/favicon.svg` vs `/favicon-running.svg`) is unchanged, so `app/utils/favicon.ts` and `app/app.vue` need no behavioral change — only the `REQ-268` reference in the `favicon.ts` comment is updated to REQ-369.

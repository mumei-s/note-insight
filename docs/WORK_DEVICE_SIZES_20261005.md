# Device display follow-up — 2026-10-05 JST

Base main: 8a74e442cd5e7aa9b09cc28e4b073baf685f72cf. User asks for tablet alongside PC and smartphone, with all UI sizes adjusted, including non-text elements.

- TOP has three persisted choices: スマホ版 / タブレット版 / PC版. Existing selected PC/mobile preferences are retained. If no choice exists, widths below 600 default to smartphone, 600–1199 to tablet, and 1200+ to PC.
- Tablet uses bottom navigation and a centered canvas. Portrait uses single-column history/charts and three metric columns; landscape (900+) can use two history/chart columns. Comment rows wrap for tablet regardless of the browser's viewport width.
- Sizes cover content/meta/headings, numeric metrics, controls, avatars, creator header, launcher icons, cards, spacing, chart area, donut charts and TOP participant showcase. Smartphone/tablet/PC content text is 13/15/16 px; avatar size is 36/48/56 px. Narrow viewports use the smartphone size even if a larger mode was saved.
- No CSS zoom or transform scaling is used. SVG viewBox/data geometry, account/session state, saved histories, readers, filtering, panel state and constant animation are preserved. Display mode changes do not key or remount data views.
- Only the app release is bumped. No userscript update is required for this follow-up.

Validate: build; three-way switch persistence and same-view state retention; automatic defaults at smartphone/tablet portrait/tablet landscape/PC boundaries; retained creator/motion behavior; deployment success and actual production TOP switch/size inspection. Local cloud browser cannot access localhost or file previews. Actual physical tablet behavior remains unverified unless tested on the device.

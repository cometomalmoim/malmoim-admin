# Season 9 autumn presentation

The Korean and English landing pages add s9-autumn to their root only. Brand logo, MALMOIM yellow #fbbc18, teal #087f8c, CTA hierarchy, poster enlargement and previous gathering gallery remain.

Seasonal accents: warm off-white background, pale cream facts panel, small decorative SVG leaves, soft photo frames and warm borders. Decorative leaves have aria-hidden and pointer-events:none. No falling animation or new raster assets.

The theme CSS is scoped to s9-autumn. Shared bilingual application and admin pages do not receive this class, so their forms and behavior are unchanged. There are no DB, payment, SMS or application policy changes.

Validation: component/layout lint, production Webpack build/TypeScript, diff check, then deployed Korean/English desktop/mobile visuals and poster interaction checks. Color values and logo source are checked from rendered DOM; no conversion gain is claimed.

## Stronger framing and English title
Replace isolated leaf accents with decorative maple branches on the left and ginkgo branches on the right. Desktop padding reserves space around the content; mobile branches are smaller and lighter. All remain aria-hidden and non-interactive. English heading is explicitly two blocks: Join MALMOIM, then a nowrap Season 9, with responsive font sizing. Additional participant-experience ideas are proposals only and are not implemented without user selection.

## Full-width scenery and leaf-pile announcement
Hero and header backgrounds now extend across the viewport; only text/poster spacing remains centered. Wide desktop branch widths fit within the outer gutters, rather than clipping at the old 1280px content boundary. Branch bottoms fade into the page. The announcement strip gains decorative maple/ginkgo leaf piles along both bottom corners, preserving readable teal deadline text and the yellow/teal brand palette. Mobile piles shrink and remain non-interactive/aria-hidden.

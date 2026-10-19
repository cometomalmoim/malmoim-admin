# Season 9 autumn presentation

The Korean and English landing pages add s9-autumn to their root only. Brand logo, MALMOIM yellow #fbbc18, teal #087f8c, CTA hierarchy, poster enlargement and previous gathering gallery remain.

Seasonal accents: warm off-white background, pale cream facts panel, small decorative SVG leaves, soft photo frames and warm borders. Decorative leaves have aria-hidden and pointer-events:none. No falling animation or new raster assets.

The theme CSS is scoped to s9-autumn. Shared bilingual application and admin pages do not receive this class, so their forms and behavior are unchanged. There are no DB, payment, SMS or application policy changes.

Validation: component/layout lint, production Webpack build/TypeScript, diff check, then deployed Korean/English desktop/mobile visuals and poster interaction checks. Color values and logo source are checked from rendered DOM; no conversion gain is claimed.

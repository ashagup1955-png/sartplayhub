# PlayHub release build notes

## Applied in this package
- Standard SEO metadata added to all 8 game pages (title, description, canonical, Open Graph, Twitter and VideoGame JSON-LD).
- Heavy Iron Snout assets are no longer eagerly precached by the service worker; assets are runtime-cached when requested.
- PlayHub shell assets use fresh/revalidated caching so unversioned JavaScript changes are not trapped behind a one-year cache.
- Game-player loading now has a 12-second failure state and a reliable Reload path.
- Local profiles no longer create new plaintext-password records; legacy plaintext profiles are upgraded on successful sign-in.
- Cloud/local account and upload paths are consolidated so the main app does not overwrite cloud functionality accidentally.
- Supabase configuration now exposes the object shape expected by the cloud client, while retaining legacy aliases.
- Catalog, game directories and local asset references were statically audited; 8 game pages and their inline game scripts parse successfully.

## One deployment-specific step remains
The real public domain is intentionally not invented in this build. The root canonical uses a same-site URL, while `sitemap.xml` is root-relative so it does not publish a fake domain. Before submitting the sitemap to Google Search Console, generate/replace the `<loc>` values with the site's absolute HTTPS origin (for example, `https://your-real-domain.example/games/...`).

## Cloud accounts
Fill the placeholders in `supabase-config.js` only if cloud accounts/uploads are required. Never put a Supabase service-role key in frontend files.

## Neon game additions
Added five self-contained single-file Canvas/Web Audio games:
- Neon Core: Orbital Defense
- Neon Catch: Void Edition
- Neon Void
- Neon Rise
- Neon Breaker

They are stored locally under `games/<id>/`, use dedicated SVG icons, and are registered in `games.js` and `sitemap.xml`. No external game assets are required.

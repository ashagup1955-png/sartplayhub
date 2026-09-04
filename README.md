# PlayHub — Robust Static Browser Games

A local/static Poki-style browser game portal.

## Included
- Responsive PlayHub homepage with search, categories, favorites, sorting and dark mode.
- Pixel Sandbox rebuilt as a bounded, touch-friendly 500-element physics lab.
- Neon Runner.
- No backend required.

## Pixel Sandbox 2.0 robustness
- Exactly 500 selectable elements.
- Visible, enforced world boundaries.
- Solids, powders, liquids, gases, fire/energy, acid, plants, food, animals and humans.
- Density-aware falling/displacement.
- Heat/burning and basic reactions.
- Touch + mouse drawing, right-click/Shift/E erase.
- Adjustable brush size and pressure.
- Pause/play, clear, randomize and demo world.
- Undo/redo history.
- Local save/load.
- Search and category filtering across all 500 elements.
- World preserved across resize/orientation changes.
- Mobile-safe UI with safe-area support.
- Pixel rendering optimized for the browser canvas.

## Run
Open `index.html` in a modern browser, or serve the folder with any static HTTP server.

## Cloud accounts
This build includes optional Supabase integration. See `README_SUPABASE.md` and `supabase/schema.sql`. The frontend intentionally contains placeholder credentials until you configure your own Supabase project.


### Added games
The release includes five additional self-contained neon arcade games: Neon Core, Neon Catch, Neon Void, Neon Rise, and Neon Breaker.

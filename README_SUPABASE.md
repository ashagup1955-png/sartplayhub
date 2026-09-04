# PlayHub — Supabase setup

This package is Supabase-ready. It keeps the existing offline game catalog but adds real cloud authentication and cloud game uploads when configured.

## 1. Create a Supabase project
Create a project in Supabase and open the SQL Editor.

## 2. Run the database/storage schema
Copy `supabase/schema.sql` into the SQL Editor and run it.

## 3. Configure the frontend
The supplied build already has the following browser-safe project values configured in `supabase-config.js`:
- `PLAYHUB_SUPABASE_URL`: your project URL
- `PLAYHUB_SUPABASE_ANON_KEY`: your publishable client key

If **Automatically expose new tables** was turned off during project creation, expose the PlayHub tables used by the Data API (at minimum `profiles`, `games`, `game_name_overrides`, and `activity_logs`) in Supabase before testing cloud features.

Never put a Supabase `service_role` key in this frontend.

## 4. Authentication
In Supabase Authentication settings, configure:
- Email/password provider
- Email confirmation
- Password recovery redirect URL for your deployed PlayHub site

## 5. Deploy
Serve the folder from a web host (or local dev server). The cloud features require network access to Supabase; the bundled built-in games still work locally/offline.

## Security notes
- RLS restricts game writes/updates/deletes to the authenticated owner.
- Uploaded files are limited to 8 MB in the client and database metadata.
- Storage paths are namespaced by authenticated user ID.
- Do not expose service-role credentials.
- For production, add server-side HTML sanitization/scanning before publishing arbitrary uploaded HTML. An HTML game is executable code and should ideally be served from an isolated origin/domain rather than the main PlayHub origin.

## Offline / Online security behavior

PlayHub now detects connectivity using the browser's `online`/`offline` events.
When there is no internet connection, **cloud authentication, password reset, cloud uploads, and cloud database access are paused**. Existing local games remain playable and local-only storage remains available.

When connectivity returns, PlayHub automatically re-enables the cloud account layer and attempts to restore the Supabase session and cloud game library.

For security, this implementation does **not** disable browser or application security offline. It disables only features that require a trusted cloud connection. Supabase Row Level Security remains the authoritative server-side protection whenever cloud access is available.


Apply the current SQL schema before deploying. It includes the cloud game-name override table used by the owner controls.

## Activity log management
The owner dashboard records cloud sign-ins, game uploads, and game plays in `public.activity_logs`. Run the latest `supabase-schema.sql` in Supabase SQL Editor. The activity table uses RLS so only the owner can read logs; authenticated users can only create their own activity records, and a database trigger stamps the authenticated identity. The dashboard subscribes to Supabase Realtime for new log entries.

## Owner-only game management
The release now includes an owner-admin layer. Run `supabase/admin-access.sql` after creating your owner account. Replace `YOUR_EMAIL_HERE` with the email of your owner account and execute it once. After that, only that Supabase user can edit or delete any cloud game, update/delete game files, or change the visibility/metadata of bundled games. Non-owner users can still play games and use the normal community upload flow.

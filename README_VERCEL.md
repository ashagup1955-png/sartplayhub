# PlayHub — Vercel deployment

This is a static HTML/CSS/JS build prepared for Vercel.

## One-click deployment

1. Put this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project**.
3. Import the repository.
4. Framework preset: **Other**.
5. Build command: leave empty.
6. Output directory: leave empty.
7. Deploy.

`index.html` is at the repository root, and `vercel.json` supplies cache/security headers.

## Supabase

Supabase remains separate from Vercel. Configure the values in `supabase-config.js` before deploying if your build does not already contain them. Never put a Supabase service-role key in frontend files; only the public/anon key belongs in a browser app.

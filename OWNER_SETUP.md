# PlayHub Owner Setup

1. Create your personal PlayHub account in the site first.
2. In Supabase SQL Editor, open `supabase/admin-access.sql`.
3. Replace `YOUR_EMAIL_HERE` with the exact email of that account.
4. Run the file. It adds that Auth user to `public.playhub_admins`.
5. Sign out of PlayHub and sign back in. The **Admin** button will appear only for that account.

Security model:
- Supabase Row Level Security enforces owner-only UPDATE/DELETE permissions in the database.
- The browser UI is only a convenience; it is not the security boundary.
- Other users can never gain owner permissions by editing JavaScript in their browser.
- Deleting a bundled game hides it from the catalog; the bundled HTML file remains in the deployment until you remove it from the release ZIP.

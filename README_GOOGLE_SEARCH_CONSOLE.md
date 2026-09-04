# PlayHub — Google Search Console release setup

This build contains 87 indexable game pages plus the PlayHub homepage.

## Before submitting the sitemap
Run the included generator with your real public HTTPS domain:

```bash
python generate_sitemap.py https://your-real-domain.example
```

That writes a Search Console-ready `sitemap.xml` containing absolute URLs. Do not submit the development/root-relative sitemap before generating the deployed-domain version.

## Search Console
1. Deploy the finished site on the real HTTPS domain.
2. Add/verify the domain property in Google Search Console.
3. Submit `/sitemap.xml`.
4. Inspect the homepage and important game URLs with URL Inspection.
5. Request indexing for the homepage and a small set of representative game pages.

## SEO already prepared
- Unique game titles and descriptions for all 8 game pages.
- Same-site canonical links on individual game pages.
- Open Graph and Twitter metadata.
- `VideoGame` JSON-LD on individual game pages.
- Crawlable `/games/<slug>/` URLs.
- `robots.txt` with a sitemap declaration.

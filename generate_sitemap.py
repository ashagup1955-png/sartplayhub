#!/usr/bin/env python3
"""Generate a valid absolute sitemap.xml for a deployed PlayHub site.
Usage: python generate_sitemap.py https://example.com
"""
from pathlib import Path
from urllib.parse import urljoin
import html, sys

if len(sys.argv) != 2 or not sys.argv[1].startswith(('https://','http://')):
    raise SystemExit('Usage: python generate_sitemap.py https://your-real-domain.example')
base=sys.argv[1].rstrip('/')+'/'
root=Path(__file__).parent
pages=['/']+sorted('/'+p.as_posix().replace('index.html','').rstrip('/')+'/' for p in root.glob('games/*/index.html'))
# Deduplicate and prefer stable order.
pages=list(dict.fromkeys(pages))
rows=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for path in pages:
    rows.append(f'  <url><loc>{html.escape(urljoin(base,path.lstrip("/")))}</loc></url>')
rows.append('</urlset>')
(root/'sitemap.xml').write_text('\n'.join(rows)+'\n',encoding='utf-8')
print(f'Generated sitemap.xml with {len(pages)} URLs for {base}')

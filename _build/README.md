# Building pdfprivate.com

The site is plain HTML, CSS and JavaScript served by GitHub Pages. This
folder holds the build helpers. Folders starting with `_` are not published.

## When you change page titles, descriptions, FAQs or add a tool

Edit `site_data.py` (and `bodies/<tool>.html` for a new tool's markup), then
from the repo root run:

```
python3 _build/build.py
```

This rewrites every page's `<head>` (between `<!-- head:start -->` and
`<!-- head:end -->`), the FAQ/related-tools section (between
`<!-- content:start -->` and `<!-- content:end -->`), the "Compress PDF to
<size>" landing pages, `sitemap.xml`, and the offline file list in `sw.js`.
Don't hand-edit inside those markers or the generated files; your edits would
be overwritten.

## When you use new Tailwind classes

`css/tailwind.css` is compiled (the Tailwind CDN is not used, so the site makes
no third-party requests). After adding classes that aren't used anywhere yet:

```
cd _build
npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o ../css/tailwind.css --minify
cd ..
python3 _build/build.py   # refresh the offline cache version
```

## Third-party libraries

Served from `/vendor` (no CDN):

- pdf.js 3.4.120 (`pdf.min.js`, `pdf.worker.min.js`)
- pdf-lib 1.17.1
- JSZip 3.10.1

Space Grotesk font files are in `/fonts`.

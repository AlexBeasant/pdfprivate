#!/usr/bin/env python3
"""
Build script for pdfprivate.com (a static site served by GitHub Pages).

What it does, every time it runs:
  * writes the shared <head> (SEO, social cards, structured data, local
    CSS/fonts, app manifest) between <!-- head:start --> / <!-- head:end -->
  * writes the "How to / FAQ / Related tools" section between
    <!-- content:start --> / <!-- content:end --> on tool pages
  * creates new tool pages from _build/bodies/<slug>.html
  * creates the "Compress PDF to <size>" landing pages from pages/compress.html
  * regenerates sitemap.xml and the offline cache list in sw.js

Folders starting with "_" are not published by GitHub Pages (Jekyll).

Usage:  python3 _build/build.py           (from the repo root)
CSS:    see _build/README.md for rebuilding css/tailwind.css
"""

import datetime
import hashlib
import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from site_data import PAGES, LEGAL_PAGES, TOOLS, SITE, SITE_NAME  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
BODIES = ROOT / "_build" / "bodies"
TODAY = datetime.date.today().isoformat()

HEAD_RE = re.compile(r"<!-- head:start -->.*?<!-- head:end -->", re.S)
CONTENT_RE = re.compile(r"<!-- content:start -->.*?<!-- content:end -->", re.S)

esc = html.escape


# --------------------------------------------------------------------------
# <head>
# --------------------------------------------------------------------------

def page_url(rel, data):
    return SITE + data.get("path", "/" + rel)


def structured_data(rel, data):
    url = page_url(rel, data)
    graph = []
    if rel == "index.html":
        graph.append({
            "@type": "WebSite", "name": SITE_NAME, "url": SITE + "/",
            "description": data["description"],
        })
    elif "tool" in data:
        graph.append({
            "@type": "WebApplication",
            "name": data.get("h1") or TOOLS[data["tool"]][0],
            "url": url,
            "description": data["description"],
            "applicationCategory": "UtilitiesApplication",
            "operatingSystem": "Any (runs in a web browser)",
            "browserRequirements": "Requires a modern web browser with JavaScript",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": SITE_NAME, "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": data.get("h1") or TOOLS[data["tool"]][0], "item": url},
            ],
        })
    if data.get("faq"):
        graph.append({
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in data["faq"]
            ],
        })
    if not graph:
        return ""
    payload = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return f'    <script type="application/ld+json">\n{payload}\n    </script>\n'


def build_head(rel, data, tailwind=True):
    url = page_url(rel, data)
    title = esc(data["title"])
    desc = esc(data["description"])
    lines = [
        "<!-- head:start -->",
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        f"    <title>{title}</title>",
        f'    <meta name="description" content="{desc}">',
        f'    <link rel="canonical" href="{url}">',
        '    <meta name="theme-color" content="#16a34a">',
        f'    <meta property="og:site_name" content="{SITE_NAME}">',
        '    <meta property="og:type" content="website">',
        f'    <meta property="og:title" content="{title}">',
        f'    <meta property="og:description" content="{desc}">',
        f'    <meta property="og:url" content="{url}">',
        f'    <meta property="og:image" content="{SITE}/icons/og-image.png">',
        '    <meta property="og:image:width" content="1200">',
        '    <meta property="og:image:height" content="630">',
        '    <meta name="twitter:card" content="summary_large_image">',
        '    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg">',
        '    <link rel="apple-touch-icon" href="/icons/icon-192.png">',
        '    <link rel="manifest" href="/manifest.webmanifest">',
    ]
    if tailwind:
        lines += [
            '    <link rel="preload" href="/fonts/space-grotesk-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>',
            '    <link rel="stylesheet" href="/css/tailwind.css">',
            '    <link rel="stylesheet" href="/css/styles.css">',
        ]
    lines.append('    <script src="/js/sw-register.js" defer></script>')
    head = "\n".join(lines) + "\n" + structured_data(rel, data) + "    <!-- head:end -->"
    return head


# --------------------------------------------------------------------------
# Bottom-of-page content: how to, FAQ, related tools
# --------------------------------------------------------------------------

def tool_card(key):
    name, blurb, href = TOOLS[key]
    return (
        f'                <a href="{href}" class="block bg-white border border-gray-200 rounded-xl p-4 '
        f'hover:border-primary-400 hover:shadow-md transition">\n'
        f'                    <div class="font-semibold text-gray-900">{esc(name)}</div>\n'
        f'                    <div class="text-sm text-gray-600 mt-1">{esc(blurb)}</div>\n'
        f'                </a>'
    )


def build_content(data):
    parts = ['<!-- content:start -->', '        <section class="mt-12 space-y-10">']
    name = data.get("h1") or TOOLS[data["tool"]][0]

    if data.get("howto"):
        steps = "\n".join(f"                <li>{esc(s)}</li>" for s in data["howto"])
        parts.append(
            '            <div>\n'
            f'                <h2 class="text-xl font-bold text-gray-900 mb-3">How to {esc(name[0].lower() + name[1:])}</h2>\n'
            '                <ol class="list-decimal pl-5 space-y-1 text-gray-700">\n'
            f'{steps}\n'
            '                </ol>\n'
            '            </div>'
        )

    if data.get("faq"):
        items = "\n".join(
            '                <details class="faq-item bg-white border border-gray-200 rounded-xl p-4">\n'
            f'                    <summary class="font-medium text-gray-900">{esc(q)}</summary>\n'
            f'                    <p class="mt-2 text-gray-600 text-sm leading-relaxed">{esc(a)}</p>\n'
            '                </details>'
            for q, a in data["faq"]
        )
        parts.append(
            '            <div>\n'
            '                <h2 class="text-xl font-bold text-gray-900 mb-3">Frequently asked questions</h2>\n'
            '                <div class="space-y-3">\n'
            f'{items}\n'
            '                </div>\n'
            '            </div>'
        )

    if data.get("extra_links"):
        links = "\n".join(
            f'                <a href="{href}" class="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm '
            f'text-gray-700 hover:border-primary-400 hover:text-primary-700">{esc(label)}</a>'
            for label, href in data["extra_links"]
        )
        parts.append(
            '            <div>\n'
            '                <h2 class="text-xl font-bold text-gray-900 mb-3">Need a specific size?</h2>\n'
            '                <div class="flex flex-wrap gap-2">\n'
            f'{links}\n'
            '                </div>\n'
            '            </div>'
        )

    if data.get("related"):
        cards = "\n".join(tool_card(k) for k in data["related"])
        parts.append(
            '            <div>\n'
            '                <h2 class="text-xl font-bold text-gray-900 mb-3">Next step</h2>\n'
            '                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">\n'
            f'{cards}\n'
            '                </div>\n'
            '                <p class="mt-4 text-sm"><a href="/" class="text-primary-700 hover:underline">See all PDF tools &rarr;</a></p>\n'
            '            </div>'
        )

    parts.append('        </section>')
    parts.append('        <!-- content:end -->')
    return "\n".join(parts)


def build_index_content(data):
    items = "\n".join(
        '                <details class="faq-item bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">\n'
        f'                    <summary class="font-medium text-gray-900 dark:text-white">{esc(q)}</summary>\n'
        f'                    <p class="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{esc(a)}</p>\n'
        '                </details>'
        for q, a in data["faq"]
    )
    return (
        '<!-- content:start -->\n'
        '    <section class="py-20 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">\n'
        '        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">\n'
        '            <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">Frequently asked questions</h2>\n'
        '            <div class="space-y-3">\n'
        f'{items}\n'
        '            </div>\n'
        '        </div>\n'
        '    </section>\n'
        '    <!-- content:end -->'
    )


# --------------------------------------------------------------------------
# New tool pages and landing pages
# --------------------------------------------------------------------------

FILE_INFO = '''<!-- File Info -->
        <div id="fileInfo" class="hidden bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <div>
                        <div id="fileName" class="font-medium text-gray-900">document.pdf</div>
                        <div id="fileMeta" class="text-sm text-gray-500"></div>
                    </div>
                </div>
                <button id="changeFileBtn" class="text-sm text-primary-600 hover:text-primary-700 font-medium">Change file</button>
            </div>
        </div>'''

PROGRESS = '''<!-- Progress Section -->
        <div id="progressSection" class="hidden mb-6">
            <div class="bg-white border border-gray-200 rounded-xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <span class="font-medium text-gray-900">{label}</span>
                    <span id="progressPercent" class="text-sm text-gray-600">0%</span>
                </div>
                <div class="progress-bar">
                    <div id="progressBar" class="progress" style="width: 0%"></div>
                </div>
                <p id="progressText" class="text-sm text-gray-500 mt-2">Preparing...</p>
            </div>
        </div>'''

RESULT = '''<!-- Result Section -->
        <div id="resultSection" class="hidden result-section">
            <svg class="w-16 h-16 mx-auto text-primary-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3>{title}</h3>
            <p id="resultInfo">Your PDF is ready for download.</p>
            <div class="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                <button id="downloadBtn" class="btn btn-primary">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    Download PDF
                </button>
                <button id="processAnotherBtn" class="btn btn-secondary">Process Another</button>
            </div>
        </div>'''

TOOL_SHELL = '''<!DOCTYPE html>
<html lang="en">
<head>
    {head}
</head>
<body class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-100">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <a href="../index.html" class="flex items-center space-x-2 group">
                    <div class="w-9 h-9 bg-gradient-to-br from-primary-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z"/>
                        </svg>
                    </div>
                    <span class="text-xl font-brand">
                        <span class="font-bold text-gray-900">PDF</span><span class="font-medium text-primary-600">Private</span>
                    </span>
                </a>
                <div class="privacy-badge">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path>
                    </svg>
                    <span>100% Private</span>
                </div>
            </div>
        </div>
    </nav>

    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <!-- Header -->
        <div class="mb-8">
            <a href="../index.html" class="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 mb-4">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Tools
            </a>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">{h1}</h1>
            <p class="text-gray-600">{intro}</p>
        </div>

{body}
        <!-- Privacy Notice -->
        <div class="mt-8 p-4 bg-primary-50 rounded-xl border border-primary-100">
            <div class="flex items-start space-x-3">
                <svg class="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <div>
                    <h4 class="font-semibold text-primary-800">Your files stay private</h4>
                    <p class="text-sm text-primary-700">All processing happens right here in your browser. Your PDFs are never uploaded to any server.</p>
                </div>
            </div>
        </div>

        <!-- content:start --><!-- content:end -->
    </main>

    <!-- Scripts -->
{scripts}
    <script src="../js/app.js"></script>
    <script src="../js/{js}"></script>
</body>
</html>
'''


def expand_placeholders(body):
    body = body.replace("{{FILE_INFO}}", FILE_INFO)
    body = re.sub(r"\{\{PROGRESS:(.*?)\}\}", lambda m: PROGRESS.format(label=esc(m.group(1))), body)
    body = re.sub(r"\{\{RESULT:(.*?)\}\}", lambda m: RESULT.format(title=esc(m.group(1))), body)
    return body


def create_new_tool_page(rel, data):
    slug = pathlib.Path(rel).stem
    body = expand_placeholders((BODIES / f"{slug}.html").read_text())
    scripts = "\n".join(f'    <script src="../vendor/{s}"></script>' for s in data["scripts"])
    page = TOOL_SHELL.format(
        head="<!-- head:start --><!-- head:end -->",
        h1=esc(data["h1"]), intro=esc(data["intro"]),
        body=body, scripts=scripts, js=data["js"],
    )
    (ROOT / rel).write_text(page)


def create_landing_page(rel, data):
    src = (ROOT / data["landing_from"]).read_text()
    src = re.sub(r'<main class="([^"]*)"[^>]*>', rf'<main class="\1" data-target-kb="{data["target_kb"]}">', src, count=1)
    src = re.sub(r'<h1 class="([^"]*)">.*?</h1>', rf'<h1 class="\1">{esc(data["h1"])}</h1>', src, count=1, flags=re.S)
    src = re.sub(r'(</h1>\s*<p class="[^"]*">).*?(</p>)', rf'\g<1>{esc(data["intro"])}\g<2>', src, count=1, flags=re.S)
    (ROOT / rel).write_text(src)


# --------------------------------------------------------------------------
# One-off migration of hand-written pages (safe to re-run)
# --------------------------------------------------------------------------

CDN_SCRIPTS = {
    r'https://unpkg\.com/pdfjs-dist@[\d.]+/build/pdf\.min\.js': "../vendor/pdf.min.js",
    r'https://unpkg\.com/pdf-lib@[\d.]+/dist/pdf-lib\.min\.js': "../vendor/pdf-lib.min.js",
    r'https://cdnjs\.cloudflare\.com/ajax/libs/jszip/[\d.]+/jszip\.min\.js': "../vendor/jszip.min.js",
}


def migrate(text, rel):
    # Old head: from <meta charset> up to the end of the inline Tailwind CDN config
    if "<!-- head:start -->" not in text:
        new, n = re.subn(r'<meta charset="UTF-8">.*?tailwind\.config.*?</script>',
                         "<!-- head:start --><!-- head:end -->", text, count=1, flags=re.S)
        if not n:  # legal pages: plain head without Tailwind
            new, n = re.subn(r'<meta charset="UTF-8">.*?</title>',
                             "<!-- head:start --><!-- head:end -->", text, count=1, flags=re.S)
        if not n:
            raise SystemExit(f"Could not find head in {rel}")
        text = new
    for pattern, local in CDN_SCRIPTS.items():
        text = re.sub(pattern, local, text)
    # The brand font is now self-hosted and applied with a class
    text = text.replace('style="font-family: \'Space Grotesk\', sans-serif;"', 'class="font-brand"')
    text = text.replace('class="text-xl" class="font-brand"', 'class="text-xl font-brand"')
    # Tool pages: add the content block before </main>
    if rel.startswith("pages/") and "<!-- content:start -->" not in text:
        text = text.replace("    </main>", "\n        <!-- content:start --><!-- content:end -->\n    </main>", 1)
    return text


# --------------------------------------------------------------------------
# Sitemap and offline cache
# --------------------------------------------------------------------------

def write_sitemap():
    urls = []
    for rel, data in PAGES.items():
        prio = "1.0" if rel == "index.html" else ("0.9" if not data.get("landing_from") else "0.8")
        urls.append((page_url(rel, data), prio, "monthly"))
    for rel, data in LEGAL_PAGES.items():
        urls.append((page_url(rel, data), "0.3", "yearly"))
    body = "\n".join(
        f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{TODAY}</lastmod>\n"
        f"    <changefreq>{freq}</changefreq>\n    <priority>{p}</priority>\n  </url>"
        for u, p, freq in urls
    )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n</urlset>\n"
    )


def write_service_worker():
    assets = ["/"]
    for rel in list(PAGES) + list(LEGAL_PAGES):
        if rel != "index.html":
            assets.append("/" + rel)
    for folder in ["css", "js", "vendor", "fonts", "icons"]:
        for f in sorted((ROOT / folder).glob("*")):
            if f.is_file():
                assets.append(f"/{folder}/{f.name}")
    assets.append("/manifest.webmanifest")

    digest = hashlib.sha256()
    for a in assets:
        path = ROOT / ("index.html" if a == "/" else a.lstrip("/"))
        digest.update(a.encode())
        if path.exists():
            digest.update(path.read_bytes())
    version = digest.hexdigest()[:12]

    template = (ROOT / "_build" / "sw.template.js").read_text()
    out = template.replace("__VERSION__", version).replace(
        "__ASSETS__", json.dumps(assets, indent=4).replace("\n", "\n    "))
    (ROOT / "sw.js").write_text(out)
    return version, len(assets)


# --------------------------------------------------------------------------

def main():
    for rel, data in PAGES.items():
        if data.get("new"):
            create_new_tool_page(rel, data)
        elif data.get("landing_from"):
            create_landing_page(rel, data)

    for rel, data in {**PAGES, **LEGAL_PAGES}.items():
        path = ROOT / rel
        text = migrate(path.read_text(), rel)
        text = HEAD_RE.sub(lambda _: build_head(rel, data, tailwind=rel not in LEGAL_PAGES), text, count=1)
        if rel == "index.html":
            if "<!-- content:start -->" not in text:
                text = text.replace("    <!-- Footer -->", "    <!-- content:start --><!-- content:end -->\n\n    <!-- Footer -->", 1)
            text = CONTENT_RE.sub(lambda _: build_index_content(data), text, count=1)
        elif rel in PAGES:
            text = CONTENT_RE.sub(lambda _: build_content(data), text, count=1)
        path.write_text(text)

    write_sitemap()
    version, n = write_service_worker()
    print(f"Built {len(PAGES) + len(LEGAL_PAGES)} pages, sitemap, and sw.js (cache {version}, {n} files)")


if __name__ == "__main__":
    main()

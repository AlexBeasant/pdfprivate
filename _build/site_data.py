"""
Per-page SEO data for pdfprivate.com.

Each entry drives the page <head> (title, description, canonical, social
cards, structured data) and the "how it works / FAQ / related tools"
section at the bottom of every tool page. Edit here, then run build.py.
"""

SITE = "https://pdfprivate.com"
SITE_NAME = "PDF Private"

UPLOAD_FAQ = (
    "Are my files uploaded to a server?",
    "No. PDF Private runs entirely in your web browser. Your file is read into your device's memory, "
    "processed by code running on your device, and saved straight back to your downloads. "
    "It never travels over the internet, so we never see it. You can even disconnect from the internet "
    "after the page loads and the tool still works.",
)
FREE_FAQ = (
    "Is it really free?",
    "Yes. There is no sign-up, no watermark, no daily limit and no paid tier. "
    "Because your device does the work, there are no server costs to pass on.",
)

# Tool cards shown in "Related tools" and on the homepage
TOOLS = {
    "merge": ("Merge PDF", "Combine several PDFs into one file.", "/pages/merge.html"),
    "compress": ("Compress PDF", "Shrink a PDF, or fit it under an exact size.", "/pages/compress.html"),
    "split": ("Split PDF", "Extract the pages you need into a new PDF.", "/pages/split.html"),
    "redact": ("Redact PDF", "Permanently black out names, numbers and text.", "/pages/redact.html"),
    "remove-metadata": ("Remove Metadata", "Strip author, dates and hidden document info.", "/pages/remove-metadata.html"),
    "rotate": ("Rotate PDF", "Turn pages the right way up, without quality loss.", "/pages/rotate.html"),
    "delete-pages": ("Delete Pages", "Remove unwanted pages from a PDF.", "/pages/delete-pages.html"),
    "images-to-pdf": ("Images to PDF", "Turn JPG, PNG or WebP images into a PDF.", "/pages/images-to-pdf.html"),
    "pdf-to-images": ("PDF to Images", "Save PDF pages as JPG or PNG images.", "/pages/pdf-to-images.html"),
}

PAGES = {
    "index.html": {
        "path": "/",
        "title": "Free Private PDF Tools — No Upload, Works Offline | PDF Private",
        "description": "Free PDF tools that never upload your files. Merge, compress, split, redact and convert PDFs entirely in your browser. No sign-up, no tracking.",
        "faq": [
            UPLOAD_FAQ,
            FREE_FAQ,
            ("How can PDF tools work without uploading?",
             "Modern browsers can run the same kind of PDF software that used to need a server. "
             "PDF Private loads open-source PDF libraries (PDF.js and pdf-lib) from this website, then does all "
             "the work on your own device."),
            ("Do you track me?",
             "No. There are no analytics, advertising or tracking scripts and no cookies. "
             "Every file the site needs, including fonts, is served from pdfprivate.com itself, so no other "
             "company is contacted when you visit."),
            ("Can I use it offline?",
             "Yes. Once you have visited a tool, it is saved by your browser and works without an internet "
             "connection. You can also install PDF Private as an app from your browser's menu."),
        ],
    },
    "pages/merge.html": {
        "tool": "merge",
        "title": "Merge PDF Files Free — No Upload, Works Offline | PDF Private",
        "description": "Combine multiple PDFs into one file in your browser. Drag to reorder, then download. Files never leave your device. Free, no sign-up.",
        "howto": [
            "Drop two or more PDF files onto the page, or click to choose them.",
            "Drag the files into the order you want.",
            "Click Merge and download your combined PDF.",
        ],
        "faq": [
            UPLOAD_FAQ,
            ("Is there a limit on file size or number of files?",
             "There is no fixed limit. Very large files depend on your device's memory; most computers and phones handle hundreds of pages comfortably."),
            ("Does merging reduce quality?",
             "No. Pages are copied exactly as they are, so text stays sharp and selectable."),
            FREE_FAQ,
        ],
        "related": ["compress", "split", "delete-pages", "rotate"],
    },
    "pages/compress.html": {
        "tool": "compress",
        "title": "Compress PDF Free — Choose an Exact Size, No Upload | PDF Private",
        "description": "Reduce PDF file size privately in your browser. Pick a compression level or a target size like 200KB or 1MB. Files never leave your device.",
        "howto": [
            "Drop your PDF onto the page.",
            "Choose a compression level, or choose Target file size and pick a limit such as 200 KB or 1 MB.",
            "Click Compress and download the smaller PDF.",
        ],
        "faq": [
            UPLOAD_FAQ,
            ("How do I get a PDF under a specific size, like 200KB?",
             "Choose Target file size and pick the limit. The tool tries several quality levels and keeps the best-looking version that fits. "
             "If even the smallest version is too big, it tells you, and splitting the PDF into parts is the next step."),
            ("Will compressed text still be selectable?",
             "Compression works by turning each page into an optimised image, so text in the compressed file can't be selected or searched. "
             "Keep your original if you need that."),
            FREE_FAQ,
        ],
        "related": ["split", "merge", "remove-metadata", "pdf-to-images"],
        "extra_links": [
            ("Compress PDF to 100KB", "/pages/compress-pdf-to-100kb.html"),
            ("Compress PDF to 200KB", "/pages/compress-pdf-to-200kb.html"),
            ("Compress PDF to 500KB", "/pages/compress-pdf-to-500kb.html"),
            ("Compress PDF to 1MB", "/pages/compress-pdf-to-1mb.html"),
            ("Compress PDF to 2MB", "/pages/compress-pdf-to-2mb.html"),
        ],
    },
    "pages/split.html": {
        "tool": "split",
        "title": "Split PDF & Extract Pages Free — No Upload | PDF Private",
        "description": "Extract specific pages from a PDF in your browser. Click pages or type a range like 1-3, 7. Your file never leaves your device. Free.",
        "howto": [
            "Drop your PDF onto the page.",
            "Click the pages you want to keep, or type a range such as 1-3, 7.",
            "Click Extract and download the new PDF.",
        ],
        "faq": [
            UPLOAD_FAQ,
            ("Does splitting change the original file?",
             "No. Your original stays exactly as it was. You get a new PDF containing only the pages you picked, at full quality."),
            ("How do I remove pages instead of keeping them?",
             "Use the Delete Pages tool: click the pages you don't want and download the rest."),
            FREE_FAQ,
        ],
        "related": ["delete-pages", "merge", "compress", "rotate"],
    },
    "pages/images-to-pdf.html": {
        "tool": "images-to-pdf",
        "title": "JPG to PDF — Convert Images to PDF Free, No Upload | PDF Private",
        "description": "Convert JPG, PNG or WebP images into a single PDF in your browser. Reorder pages, choose page size. Photos never leave your device.",
        "howto": [
            "Drop your images onto the page (JPG, PNG or WebP).",
            "Drag them into the right order and pick your page options.",
            "Click Convert and download your PDF.",
        ],
        "faq": [
            UPLOAD_FAQ,
            ("Can I convert photos from my phone?",
             "Yes. Open PDF Private in your phone's browser and choose photos from your gallery. They are converted on the phone itself."),
            ("Will image quality be reduced?",
             "Images are placed into the PDF at their original quality. If the result is too large, use Compress PDF afterwards."),
            FREE_FAQ,
        ],
        "related": ["compress", "merge", "pdf-to-images", "remove-metadata"],
    },
    "pages/pdf-to-images.html": {
        "tool": "pdf-to-images",
        "title": "PDF to JPG or PNG — Convert PDF to Images Free, No Upload | PDF Private",
        "description": "Save every page of a PDF as a high-quality JPG or PNG image, right in your browser. Download as a ZIP. Your file never leaves your device.",
        "howto": [
            "Drop your PDF onto the page.",
            "Choose JPG or PNG and the image quality.",
            "Click Convert and download the images.",
        ],
        "faq": [
            UPLOAD_FAQ,
            ("JPG or PNG: which should I choose?",
             "JPG gives smaller files and suits photos and scans. PNG is lossless and best for sharp text, diagrams and screenshots."),
            ("Can I convert just one page?",
             "Convert the PDF, then keep the images you need, or use Split PDF first to pick the pages."),
            FREE_FAQ,
        ],
        "related": ["images-to-pdf", "split", "compress", "redact"],
    },
    "pages/redact.html": {
        "tool": "redact",
        "new": True,
        "h1": "Redact PDF",
        "intro": "Permanently black out names, account numbers and other sensitive text. The text under each box is deleted, not just hidden.",
        "scripts": ["pdf.min.js", "pdf-lib.min.js"],
        "js": "redact.js",
        "title": "Redact PDF Free — Permanently Black Out Text, No Upload | PDF Private",
        "description": "Black out sensitive text in a PDF so it can't be recovered. Search for a name or number, or draw boxes. Runs in your browser; nothing is uploaded.",
        "howto": [
            "Drop your PDF onto the page.",
            "Type a word or number and click Redact all matches, or drag on a page to draw boxes.",
            "Check every page, click Apply redactions, and download the redacted PDF.",
        ],
        "faq": [
            ("Why isn't a black rectangle in another editor enough?",
             "Drawing a shape over text only covers it. The text is still in the file and can be copied, searched or revealed by deleting the shape. "
             "PDF Private turns each redacted page into an image with the box burned in, so the original text is gone. "
             "It then re-reads the result to confirm no text remains on those pages."),
            ("Does it work on scanned documents?",
             "Yes, by drawing boxes. Scans have no text layer, so search can't find words in them, but boxes you draw are burned in the same way."),
            ("What changes in the redacted file?",
             "Redacted pages become images, so their text can no longer be selected or searched. Pages without boxes stay as they were, "
             "unless you tick Flatten every page. Bookmarks and form fields are not kept."),
            UPLOAD_FAQ,
        ],
        "related": ["remove-metadata", "split", "delete-pages", "compress"],
    },
    "pages/remove-metadata.html": {
        "tool": "remove-metadata",
        "new": True,
        "h1": "Remove PDF Metadata",
        "intro": "See and remove the hidden information inside a PDF: author name, the software used, creation dates, titles and XMP data.",
        "scripts": ["pdf-lib.min.js"],
        "js": "remove-metadata.js",
        "title": "Remove PDF Metadata Free — Author, Dates & Hidden Info | PDF Private",
        "description": "View and strip hidden PDF metadata like author, creation software, dates and XMP data before you share a file. Runs in your browser, no upload.",
        "howto": [
            "Drop your PDF onto the page to see the hidden information it contains.",
            "Click Remove all metadata.",
            "Download the clean copy. The page content is unchanged.",
        ],
        "faq": [
            ("What is PDF metadata?",
             "Information stored inside the file alongside the pages: often the author's name, the program and computer account that created it, "
             "creation and edit dates, a title and keywords. Anyone can read it in their PDF reader's document properties."),
            ("Does removing metadata change how the document looks?",
             "No. Only the hidden information is removed. Pages, text and images are copied exactly as they were."),
            ("Is anything else hidden in a PDF?",
             "Sometimes, such as covered-up text or comments. To permanently remove visible text, use the Redact PDF tool."),
            UPLOAD_FAQ,
        ],
        "related": ["redact", "compress", "split", "merge"],
    },
    "pages/rotate.html": {
        "tool": "rotate",
        "new": True,
        "h1": "Rotate PDF",
        "intro": "Turn sideways or upside-down pages the right way up. Rotate single pages or the whole document, with no loss of quality.",
        "scripts": ["pdf.min.js", "pdf-lib.min.js"],
        "js": "rotate.js",
        "title": "Rotate PDF Pages Free — Lossless, No Upload | PDF Private",
        "description": "Rotate one page or every page of a PDF in your browser. Click to turn pages 90 degrees and save. Lossless, free, and nothing is uploaded.",
        "howto": [
            "Drop your PDF onto the page.",
            "Click a page to turn it 90 degrees clockwise, or rotate all pages at once.",
            "Click Save rotated PDF and download it.",
        ],
        "faq": [
            ("Does rotating reduce quality?",
             "No. Only the page orientation setting changes, so text stays sharp and selectable."),
            ("Can I rotate just one page?",
             "Yes. Click only the pages you want to turn. Each click rotates that page by 90 degrees."),
            UPLOAD_FAQ,
            FREE_FAQ,
        ],
        "related": ["delete-pages", "merge", "split", "compress"],
    },
    "pages/delete-pages.html": {
        "tool": "delete-pages",
        "new": True,
        "h1": "Delete PDF Pages",
        "intro": "Remove blank, duplicate or unwanted pages from a PDF. Click the pages to delete and download the rest.",
        "scripts": ["pdf.min.js", "pdf-lib.min.js"],
        "js": "delete-pages.js",
        "title": "Delete PDF Pages Free — Remove Pages, No Upload | PDF Private",
        "description": "Remove pages from a PDF in your browser. Click pages or type numbers like 2, 5-7, then download. Free, lossless, and your file is never uploaded.",
        "howto": [
            "Drop your PDF onto the page.",
            "Click the pages you want to remove, or type their numbers such as 2, 5-7.",
            "Click Delete and download the edited PDF.",
        ],
        "faq": [
            ("Will the remaining pages lose quality?",
             "No. The pages you keep are copied exactly as they were."),
            ("Can I undo a deletion?",
             "Your original file is never changed, so you can always start again from it."),
            UPLOAD_FAQ,
            FREE_FAQ,
        ],
        "related": ["split", "rotate", "merge", "compress"],
    },
}

# "Compress PDF to <size>" landing pages, generated from pages/compress.html
TARGET_SIZES = [
    ("100kb", 100, "100KB", "Many job portals, exam and government forms cap uploads at 100KB."),
    ("200kb", 200, "200KB", "A common limit for application forms and online portals."),
    ("500kb", 500, "500KB", "Handy for email attachments and portals with a 500KB limit."),
    ("1mb", 1024, "1MB", "A common upload limit for visa, university and job applications."),
    ("2mb", 2048, "2MB", "Fits most email and web form limits while keeping good quality."),
]

for slug, kb, label, why in TARGET_SIZES:
    PAGES[f"pages/compress-pdf-to-{slug}.html"] = {
        "tool": "compress",
        "landing_from": "pages/compress.html",
        "target_kb": kb,
        "h1": f"Compress PDF to {label}",
        "intro": f"Get your PDF under {label} with the best quality that fits. {why} Your file never leaves your device.",
        "title": f"Compress PDF to {label} Free — No Upload | PDF Private",
        "description": f"Reduce a PDF to under {label} in your browser. We find the highest quality that fits the limit. Free, no sign-up, and your file is never uploaded.",
        "howto": [
            "Drop your PDF onto the page. The target is already set to " + label + ".",
            "Click Compress. The tool tries several quality levels and keeps the best one under " + label + ".",
            "Download the result and check it before you submit it.",
        ],
        "faq": [
            ("What if my PDF can't get under " + label + "?",
             "Long or image-heavy documents sometimes can't fit without becoming unreadable. The tool will tell you and give you the smallest version. "
             "Splitting the PDF into parts with Split PDF usually solves it."),
            ("Will the text still be readable?",
             "The tool always picks the highest quality that fits, so the result is as clear as the size limit allows. "
             "Text becomes part of an image, so it can't be selected or searched."),
            UPLOAD_FAQ,
            FREE_FAQ,
        ],
        "related": ["compress", "split", "merge", "remove-metadata"],
        "extra_links": [(f"Compress PDF to {lab}", f"/pages/compress-pdf-to-{s}.html")
                        for s, _, lab, _ in TARGET_SIZES if s != slug],
    }

LEGAL_PAGES = {
    "privacy.html": {
        "path": "/privacy.html",
        "title": "Privacy Policy — PDF Private",
        "description": "PDF Private processes your files entirely in your browser. No uploads, no analytics, no tracking and no cookies.",
    },
    "terms.html": {
        "path": "/terms.html",
        "title": "Terms of Service — PDF Private",
        "description": "Terms of service for PDF Private, the free browser-based PDF toolkit.",
    },
}

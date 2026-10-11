/**
 * Redact PDF - Private PDF Tools
 * True redaction: every page with a redaction box is re-rendered as an
 * image with the box burned in, so the underlying text is deleted rather
 * than merely hidden. Pages without boxes are copied unchanged unless
 * "flatten every page" is ticked.
 */

(function() {
    'use strict';

    if (typeof window.PDFTools === 'undefined' || typeof pdfjsLib === 'undefined' || typeof PDFLib === 'undefined') {
        console.error('Redact PDF: required libraries not loaded.');
        return;
    }

    const { Utils, DragDropZone, canvasToJpegBytes } = window.PDFTools;
    const { PDFDocument } = PDFLib;

    const OUTPUT_SCALE = 2;      // ~144 dpi output for redacted pages
    const OUTPUT_QUALITY = 0.92;
    const MIN_BOX_PX = 4;

    let pdfFile = null;
    let pdfBytes = null;
    let pdfJsDoc = null;
    let pages = []; // { el, layer, width, height (PDF points), boxes: [{x,y,w,h}] normalised 0..1 }
    let outputBytes = null;

    const $ = (id) => document.getElementById(id);
    const dropZone = $('dropZone');
    const fileInfo = $('fileInfo');
    const loadingSection = $('loadingSection');
    const toolbarSection = $('toolbarSection');
    const pagesSection = $('pagesSection');
    const pagesContainer = $('pagesContainer');
    const optionsSection = $('optionsSection');
    const actionSection = $('actionSection');
    const applyBtn = $('applyBtn');
    const progressSection = $('progressSection');
    const resultSection = $('resultSection');
    const searchInput = $('searchInput');

    new DragDropZone(dropZone, {
        accept: '.pdf,application/pdf',
        multiple: false,
        onFiles: handleFile,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    $('changeFileBtn').addEventListener('click', reset);
    $('findBtn').addEventListener('click', redactMatches);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') redactMatches(); });
    $('clearBoxesBtn').addEventListener('click', () => { pages.forEach(p => { p.boxes = []; drawBoxes(p); }); updateCount(); });
    applyBtn.addEventListener('click', applyRedactions);
    $('downloadBtn').addEventListener('click', download);
    $('processAnotherBtn').addEventListener('click', reset);

    async function handleFile(files) {
        if (!files.length) return;
        pdfFile = files[0];
        try {
            dropZone.classList.add('hidden');
            loadingSection.classList.remove('hidden');
            const buffer = await Utils.readFileAsArrayBuffer(pdfFile);
            pdfBytes = new Uint8Array(buffer.slice(0));
            pdfJsDoc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;

            $('fileName').textContent = pdfFile.name;
            $('fileMeta').textContent = `${pdfJsDoc.numPages} page${pdfJsDoc.numPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;

            // Pages must be visible to measure the available width
            pagesSection.classList.remove('hidden');
            await renderPages();

            loadingSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            toolbarSection.classList.remove('hidden');
            optionsSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
            updateCount();
        } catch (error) {
            console.error('Error loading PDF:', error);
            Utils.showToast('Failed to load PDF. Make sure it\'s a valid PDF file.', 'error');
            reset();
        }
    }

    async function renderPages() {
        pagesContainer.innerHTML = '';
        pages = [];
        const maxWidth = Math.min(pagesContainer.clientWidth || 800, 820);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= pdfJsDoc.numPages; n++) {
            $('loadingText').textContent = `Loading page ${n} of ${pdfJsDoc.numPages}...`;
            const page = await pdfJsDoc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const displayScale = maxWidth / base.width;
            const viewport = page.getViewport({ scale: displayScale * dpr });

            const wrapper = document.createElement('div');
            wrapper.className = 'redact-page';
            wrapper.style.width = `${base.width * displayScale}px`;
            wrapper.style.height = `${base.height * displayScale}px`;

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

            const layer = document.createElement('div');
            layer.className = 'redact-layer';

            const label = document.createElement('div');
            label.className = 'redact-page-label';
            label.textContent = `Page ${n}`;

            wrapper.appendChild(canvas);
            wrapper.appendChild(layer);
            wrapper.appendChild(label);
            pagesContainer.appendChild(wrapper);

            const state = { el: wrapper, layer, width: base.width, height: base.height, boxes: [] };
            pages.push(state);
            enableDrawing(state);
        }
    }

    /**
     * Let the user drag out redaction boxes on a page
     */
    function enableDrawing(state) {
        let start = null;
        let preview = null;

        state.layer.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.redact-remove')) return;
            const rect = state.layer.getBoundingClientRect();
            start = { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
            preview = document.createElement('div');
            preview.className = 'redact-box redact-preview';
            state.layer.appendChild(preview);
            state.layer.setPointerCapture(e.pointerId);
        });

        state.layer.addEventListener('pointermove', (e) => {
            if (!start) return;
            const x = Math.min(Math.max(e.clientX - start.rect.left, 0), start.rect.width);
            const y = Math.min(Math.max(e.clientY - start.rect.top, 0), start.rect.height);
            Object.assign(preview.style, {
                left: `${Math.min(start.x, x)}px`,
                top: `${Math.min(start.y, y)}px`,
                width: `${Math.abs(x - start.x)}px`,
                height: `${Math.abs(y - start.y)}px`
            });
        });

        const finish = (e) => {
            if (!start) return;
            const x = Math.min(Math.max(e.clientX - start.rect.left, 0), start.rect.width);
            const y = Math.min(Math.max(e.clientY - start.rect.top, 0), start.rect.height);
            const w = Math.abs(x - start.x);
            const h = Math.abs(y - start.y);
            if (w >= MIN_BOX_PX && h >= MIN_BOX_PX) {
                state.boxes.push({
                    x: Math.min(start.x, x) / start.rect.width,
                    y: Math.min(start.y, y) / start.rect.height,
                    w: w / start.rect.width,
                    h: h / start.rect.height
                });
            }
            preview.remove();
            start = null;
            preview = null;
            drawBoxes(state);
            updateCount();
        };
        state.layer.addEventListener('pointerup', finish);
        state.layer.addEventListener('pointercancel', finish);
    }

    function drawBoxes(state) {
        state.layer.querySelectorAll('.redact-box').forEach(b => b.remove());
        state.boxes.forEach((box, i) => {
            const el = document.createElement('div');
            el.className = 'redact-box';
            Object.assign(el.style, {
                left: `${box.x * 100}%`, top: `${box.y * 100}%`,
                width: `${box.w * 100}%`, height: `${box.h * 100}%`
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'redact-remove';
            remove.setAttribute('aria-label', 'Remove this box');
            remove.textContent = '×';
            remove.addEventListener('click', (e) => {
                e.stopPropagation();
                state.boxes.splice(i, 1);
                drawBoxes(state);
                updateCount();
            });
            el.appendChild(remove);
            state.layer.appendChild(el);
        });
    }

    function updateCount() {
        const total = pages.reduce((sum, p) => sum + p.boxes.length, 0);
        $('boxCount').textContent = `${total} box${total !== 1 ? 'es' : ''}`;
        applyBtn.disabled = total === 0 && !$('flattenAll').checked;
    }
    $('flattenAll').addEventListener('change', updateCount);

    /**
     * Add a box over every occurrence of the search text.
     * Matches are found within each text run; text split across runs may be missed.
     */
    async function redactMatches() {
        const query = searchInput.value.trim();
        if (!query) {
            Utils.showToast('Type the text you want to redact first', 'error');
            return;
        }
        const needle = query.toLowerCase();
        let found = 0;

        for (let i = 0; i < pages.length; i++) {
            const page = await pdfJsDoc.getPage(i + 1);
            const viewport = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();

            for (const item of content.items) {
                if (!item.str) continue;
                const hay = item.str.toLowerCase();
                let idx = hay.indexOf(needle);
                if (idx === -1) continue;

                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const fontHeight = Math.hypot(tx[2], tx[3]);
                const runWidth = item.width * viewport.scale;
                const charWidth = item.str.length ? runWidth / item.str.length : 0;

                while (idx !== -1) {
                    const pad = fontHeight * 0.15;
                    const x = tx[4] + idx * charWidth - pad;
                    const y = tx[5] - fontHeight - pad;
                    const w = needle.length * charWidth + pad * 2;
                    const h = fontHeight * 1.25 + pad * 2;
                    pages[i].boxes.push({
                        x: Math.max(0, x / viewport.width),
                        y: Math.max(0, y / viewport.height),
                        w: Math.min(1, w / viewport.width),
                        h: Math.min(1, h / viewport.height)
                    });
                    found++;
                    idx = hay.indexOf(needle, idx + needle.length);
                }
            }
            drawBoxes(pages[i]);
        }
        updateCount();
        Utils.showToast(found
            ? `Added ${found} box${found !== 1 ? 'es' : ''}. Check each page before applying.`
            : 'No matches found. Scanned pages have no text layer; draw boxes by hand instead.',
            found ? 'success' : 'info', 4000);
    }

    async function applyRedactions() {
        const flattenAll = $('flattenAll').checked;
        toolbarSection.classList.add('hidden');
        pagesSection.classList.add('hidden');
        optionsSection.classList.add('hidden');
        actionSection.classList.add('hidden');
        progressSection.classList.remove('hidden');

        try {
            const source = await PDFDocument.load(pdfBytes, { updateMetadata: false });
            const out = await PDFDocument.create({ updateMetadata: false });
            const flattened = [];

            for (let i = 0; i < pages.length; i++) {
                setProgress(Math.round((i / pages.length) * 85), `Processing page ${i + 1} of ${pages.length}...`);
                const state = pages[i];

                if (state.boxes.length === 0 && !flattenAll) {
                    const [copied] = await out.copyPages(source, [i]);
                    out.addPage(copied);
                    continue;
                }

                const page = await pdfJsDoc.getPage(i + 1);
                const viewport = page.getViewport({ scale: OUTPUT_SCALE });
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport }).promise;

                ctx.fillStyle = '#000000';
                for (const box of state.boxes) {
                    ctx.fillRect(
                        Math.floor(box.x * canvas.width),
                        Math.floor(box.y * canvas.height),
                        Math.ceil(box.w * canvas.width) + 1,
                        Math.ceil(box.h * canvas.height) + 1
                    );
                }

                const jpeg = await out.embedJpg(await canvasToJpegBytes(canvas, OUTPUT_QUALITY));
                const newPage = out.addPage([state.width, state.height]);
                newPage.drawImage(jpeg, { x: 0, y: 0, width: state.width, height: state.height });
                flattened.push(i + 1);
                canvas.width = canvas.height = 0;
            }

            setProgress(90, 'Saving PDF...');
            outputBytes = await out.save();

            // Verify: redacted pages must contain no extractable text
            setProgress(95, 'Checking that no text remains under the boxes...');
            const check = await pdfjsLib.getDocument({ data: outputBytes.slice(0) }).promise;
            let leftover = 0;
            for (const n of flattened) {
                const text = await (await check.getPage(n)).getTextContent();
                leftover += text.items.filter(item => item.str && item.str.trim()).length;
            }
            if (leftover > 0) throw new Error('Verification failed: text found on a redacted page');

            setProgress(100, 'Complete!');
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
                $('resultInfo').textContent = `${flattened.length} page${flattened.length !== 1 ? 's' : ''} redacted and checked: no hidden text remains on them • ${Utils.formatFileSize(outputBytes.length)}`;
            }, 300);
        } catch (error) {
            console.error('Redaction error:', error);
            Utils.showToast(error.message && error.message.includes('encrypted')
                ? 'This PDF is password-protected. Unlock it first.'
                : 'Failed to apply redactions. Please try again.', 'error');
            progressSection.classList.add('hidden');
            toolbarSection.classList.remove('hidden');
            pagesSection.classList.remove('hidden');
            optionsSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        }
    }

    function setProgress(pct, text) {
        $('progressBar').style.width = `${pct}%`;
        $('progressPercent').textContent = `${pct}%`;
        $('progressText').textContent = text;
    }

    function download() {
        if (!outputBytes) return;
        Utils.downloadFile(outputBytes, `${pdfFile.name.replace(/\.pdf$/i, '')}-redacted.pdf`, 'application/pdf');
        Utils.showToast('Redacted PDF downloaded!', 'success');
    }

    function reset() {
        pdfFile = null; pdfBytes = null; pdfJsDoc = null; pages = []; outputBytes = null;
        pagesContainer.innerHTML = '';
        searchInput.value = '';
        $('flattenAll').checked = false;
        [fileInfo, loadingSection, toolbarSection, pagesSection, optionsSection, actionSection, progressSection, resultSection]
            .forEach(el => el.classList.add('hidden'));
        dropZone.classList.remove('hidden');
    }
})();

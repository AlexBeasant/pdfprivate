/**
 * Compress PDF - Private PDF Tools
 * Reduces PDF file size by re-rendering pages as JPEG images.
 * Two modes: a fixed compression level, or a target file size
 * (searches for the highest quality that fits under the limit).
 */

(function() {
    'use strict';

    if (typeof window.PDFTools === 'undefined' || typeof pdfjsLib === 'undefined' || typeof PDFLib === 'undefined') {
        console.error('Compress PDF: required libraries not loaded.');
        return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.js';

    const { Utils, DragDropZone, canvasToJpegBytes } = window.PDFTools;
    const { PDFDocument } = PDFLib;

    // Fixed compression levels
    const COMPRESSION_PRESETS = {
        low: {
            quality: 0.92,
            scale: 2,
            description: 'Minimal compression. Best quality with slight file size reduction.'
        },
        medium: {
            quality: 0.75,
            scale: 1.5,
            description: 'Balanced compression for most documents. Good quality with reasonable file size reduction.'
        },
        high: {
            quality: 0.5,
            scale: 1,
            description: 'Maximum compression. Smaller file size but noticeable quality reduction.'
        }
    };

    // Settings tried in target-size mode, from best quality to smallest file.
    // File size falls (roughly) monotonically down this list, so we binary-search it.
    const TARGET_LADDER = [
        { scale: 2, quality: 0.85 },
        { scale: 1.75, quality: 0.8 },
        { scale: 1.5, quality: 0.75 },
        { scale: 1.5, quality: 0.62 },
        { scale: 1.25, quality: 0.55 },
        { scale: 1.1, quality: 0.5 },
        { scale: 1, quality: 0.42 },
        { scale: 0.85, quality: 0.38 },
        { scale: 0.75, quality: 0.32 },
        { scale: 0.62, quality: 0.28 },
        { scale: 0.5, quality: 0.22 }
    ];

    // State
    let pdfFile = null;
    let pdfArrayBuffer = null;
    let totalPages = 0;
    let compressedPdfBytes = null;
    let originalSize = 0;
    let mode = 'level';

    // DOM Elements
    const mainEl = document.querySelector('main');
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const optionsSection = document.getElementById('optionsSection');
    const modeGroup = document.getElementById('modeGroup');
    const targetGroup = document.getElementById('targetGroup');
    const targetSize = document.getElementById('targetSize');
    const levelGroup = document.getElementById('levelGroup');
    const compressionLevel = document.getElementById('compressionLevel');
    const compressionDescription = document.getElementById('compressionDescription');
    const loadingSection = document.getElementById('loadingSection');
    const actionSection = document.getElementById('actionSection');
    const compressBtn = document.getElementById('compressBtn');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const resultInfo = document.getElementById('resultInfo');
    const targetNote = document.getElementById('targetNote');
    const originalSizeEl = document.getElementById('originalSize');
    const compressedSizeEl = document.getElementById('compressedSize');
    const reductionPercentEl = document.getElementById('reductionPercent');
    const downloadBtn = document.getElementById('downloadBtn');
    const processAnotherBtn = document.getElementById('processAnotherBtn');

    new DragDropZone(dropZone, {
        accept: '.pdf,application/pdf',
        multiple: false,
        onFiles: handleFile,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    changeFileBtn.addEventListener('click', reset);
    compressionLevel.addEventListener('change', () => {
        compressionDescription.textContent = COMPRESSION_PRESETS[compressionLevel.value].description;
    });
    modeGroup.addEventListener('change', (e) => {
        if (e.target.name === 'mode') setMode(e.target.value);
    });
    compressBtn.addEventListener('click', compressPDF);
    downloadBtn.addEventListener('click', downloadCompressedPDF);
    processAnotherBtn.addEventListener('click', reset);

    // Landing pages such as "compress PDF to 200KB" preset the target via data-target-kb
    const presetTarget = mainEl && mainEl.dataset.targetKb;
    if (presetTarget) {
        if (!Array.from(targetSize.options).some(o => o.value === presetTarget)) {
            const opt = document.createElement('option');
            opt.value = presetTarget;
            opt.textContent = formatKb(Number(presetTarget));
            targetSize.appendChild(opt);
        }
        targetSize.value = presetTarget;
        setMode('target');
    }

    function setMode(newMode) {
        mode = newMode;
        modeGroup.querySelectorAll('.radio-option').forEach(el => {
            const active = el.dataset.mode === mode;
            el.classList.toggle('selected', active);
            el.querySelector('input').checked = active;
        });
        targetGroup.classList.toggle('hidden', mode !== 'target');
        levelGroup.classList.toggle('hidden', mode !== 'level');
    }

    function formatKb(kb) {
        return kb >= 1024 ? `${+(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
    }

    async function handleFile(files) {
        if (files.length === 0) return;
        pdfFile = files[0];
        originalSize = pdfFile.size;

        try {
            dropZone.classList.add('hidden');
            loadingSection.classList.remove('hidden');

            const originalBuffer = await Utils.readFileAsArrayBuffer(pdfFile);
            pdfArrayBuffer = originalBuffer.slice(0);

            const pdf = await pdfjsLib.getDocument({ data: originalBuffer.slice(0) }).promise;
            totalPages = pdf.numPages;

            fileName.textContent = pdfFile.name;
            fileMeta.textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;

            loadingSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            optionsSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading PDF:', error);
            Utils.showToast('Failed to load PDF. Make sure it\'s a valid PDF file.', 'error');
            loadingSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
        }
    }

    /**
     * Re-render every page at the given scale and JPEG quality
     * @returns {Promise<Uint8Array>} Compressed PDF bytes
     */
    async function renderCompressed(pdf, scale, quality, onPage) {
        const newPdf = await PDFDocument.create();
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (onPage) onPage(pageNum);
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            // Output page keeps the original physical size (scale 1 = PDF points)
            const pointSize = page.getViewport({ scale: 1 });

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(viewport.width));
            canvas.height = Math.max(1, Math.round(viewport.height));
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport }).promise;

            const jpegBytes = await canvasToJpegBytes(canvas, quality);
            const jpegImage = await newPdf.embedJpg(jpegBytes);
            const newPage = newPdf.addPage([pointSize.width, pointSize.height]);
            newPage.drawImage(jpegImage, { x: 0, y: 0, width: pointSize.width, height: pointSize.height });

            canvas.width = canvas.height = 0; // free memory
        }
        return newPdf.save();
    }

    async function compressPDF() {
        actionSection.classList.add('hidden');
        optionsSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        progressSection.classList.remove('hidden');
        targetNote.classList.add('hidden');
        updateProgress(0, 'Starting compression...');

        try {
            const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer.slice(0) }).promise;

            if (mode === 'target') {
                await compressToTarget(pdf, Number(targetSize.value) * 1024);
            } else {
                const preset = COMPRESSION_PRESETS[compressionLevel.value];
                compressedPdfBytes = await renderCompressed(pdf, preset.scale, preset.quality, (n) => {
                    updateProgress(Math.round((n / totalPages) * 90), `Compressing page ${n} of ${totalPages}...`);
                });
            }

            updateProgress(100, 'Complete!');
            setTimeout(showResult, 300);
        } catch (error) {
            console.error('Compression error:', error);
            Utils.showToast('Failed to compress PDF. Please try again.', 'error');
            progressSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            optionsSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        }
    }

    /**
     * Find the best-quality setting whose output fits under targetBytes
     */
    async function compressToTarget(pdf, targetBytes) {
        const label = formatKb(targetBytes / 1024);

        if (originalSize <= targetBytes) {
            compressedPdfBytes = new Uint8Array(pdfArrayBuffer.slice(0));
            targetNote.textContent = `Your PDF is already under ${label}, so it was left unchanged at full quality.`;
            targetNote.classList.remove('hidden');
            return;
        }

        const results = new Map();
        let attempt = 0;
        const tryIndex = async (i) => {
            if (results.has(i)) return results.get(i);
            attempt++;
            const { scale, quality } = TARGET_LADDER[i];
            const bytes = await renderCompressed(pdf, scale, quality, (n) => {
                const pct = Math.min(95, Math.round(((attempt - 1) * totalPages + n) / (5 * totalPages) * 95));
                updateProgress(pct, `Finding the best quality under ${label} (try ${attempt}, page ${n} of ${totalPages})...`);
            });
            results.set(i, bytes);
            return bytes;
        };

        // If even the smallest setting is too big, return it and say so
        const last = TARGET_LADDER.length - 1;
        const smallest = await tryIndex(last);
        if (smallest.length > targetBytes) {
            compressedPdfBytes = smallest;
            targetNote.textContent = `We couldn't get this PDF under ${label} without making it unreadable. This is the smallest version (${Utils.formatFileSize(smallest.length)}). Try splitting it into parts with the Split tool.`;
            targetNote.classList.remove('hidden');
            return;
        }

        // Binary search for the lowest index (best quality) that fits
        let lo = 0;
        let hi = last; // known to fit
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            const bytes = await tryIndex(mid);
            if (bytes.length <= targetBytes) hi = mid; else lo = mid + 1;
        }
        compressedPdfBytes = results.get(hi);
    }

    function showResult() {
        progressSection.classList.add('hidden');
        resultSection.classList.remove('hidden');

        const compressedSize = compressedPdfBytes.length;
        const reduction = ((originalSize - compressedSize) / originalSize) * 100;
        originalSizeEl.textContent = Utils.formatFileSize(originalSize);
        compressedSizeEl.textContent = Utils.formatFileSize(compressedSize);

        if (reduction > 0) {
            reductionPercentEl.textContent = `-${reduction.toFixed(1)}%`;
            reductionPercentEl.className = 'font-semibold text-primary-600';
        } else {
            reductionPercentEl.textContent = reduction === 0 ? '0%' : `+${Math.abs(reduction).toFixed(1)}%`;
            reductionPercentEl.className = 'font-semibold text-orange-600';
        }
        resultInfo.textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(compressedSize)}`;
    }

    function updateProgress(percent, text) {
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressText.textContent = text;
    }

    function downloadCompressedPDF() {
        if (!compressedPdfBytes) return;
        const baseName = pdfFile.name.replace(/\.pdf$/i, '');
        Utils.downloadFile(compressedPdfBytes, `${baseName}-compressed.pdf`, 'application/pdf');
        Utils.showToast('Compressed PDF downloaded!', 'success');
    }

    function reset() {
        pdfFile = null;
        pdfArrayBuffer = null;
        totalPages = 0;
        compressedPdfBytes = null;
        originalSize = 0;

        targetNote.classList.add('hidden');
        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        optionsSection.classList.add('hidden');
        actionSection.classList.add('hidden');
        loadingSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
})();

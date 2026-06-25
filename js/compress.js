/**
 * Compress PDF - Private PDF Tools
 * Reduces PDF file size by re-rendering pages as JPEG images
 */

(function() {
    'use strict';

    // Check if dependencies are loaded
    if (typeof window.PDFTools === 'undefined') {
        console.error('PDFTools not loaded. Make sure app.js is loaded before this script.');
        return;
    }

    if (typeof pdfjsLib === 'undefined') {
        console.error('PDF.js not loaded. Make sure pdfjs-dist is loaded before this script.');
        return;
    }

    if (typeof PDFLib === 'undefined') {
        console.error('pdf-lib not loaded. Make sure pdf-lib is loaded before this script.');
        return;
    }

    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

    const { Utils, DragDropZone } = window.PDFTools;
    const { PDFDocument } = PDFLib;

    // Compression presets
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

    // State
    let pdfFile = null;
    let pdfArrayBuffer = null;
    let totalPages = 0;
    let compressedPdfBytes = null;
    let originalSize = 0;

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const optionsSection = document.getElementById('optionsSection');
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
    const originalSizeEl = document.getElementById('originalSize');
    const compressedSizeEl = document.getElementById('compressedSize');
    const reductionPercentEl = document.getElementById('reductionPercent');
    const downloadBtn = document.getElementById('downloadBtn');
    const processAnotherBtn = document.getElementById('processAnotherBtn');

    // Initialize drag and drop
    new DragDropZone(dropZone, {
        accept: '.pdf,application/pdf',
        multiple: false,
        onFiles: handleFile,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    // Event Listeners
    changeFileBtn.addEventListener('click', reset);

    compressionLevel.addEventListener('change', () => {
        const preset = COMPRESSION_PRESETS[compressionLevel.value];
        compressionDescription.textContent = preset.description;
    });

    compressBtn.addEventListener('click', compressPDF);
    downloadBtn.addEventListener('click', downloadCompressedPDF);
    processAnotherBtn.addEventListener('click', reset);

    /**
     * Handle uploaded file
     * @param {File[]} files - Array of uploaded files
     */
    async function handleFile(files) {
        if (files.length === 0) return;

        pdfFile = files[0];
        originalSize = pdfFile.size;

        try {
            // Show loading
            dropZone.classList.add('hidden');
            loadingSection.classList.remove('hidden');

            // Read file and make a copy
            const originalBuffer = await Utils.readFileAsArrayBuffer(pdfFile);
            pdfArrayBuffer = originalBuffer.slice(0);

            // Load with PDF.js to get page count
            const previewBuffer = originalBuffer.slice(0);
            const loadingTask = pdfjsLib.getDocument({ data: previewBuffer });
            const pdf = await loadingTask.promise;
            totalPages = pdf.numPages;

            // Update file info
            fileName.textContent = pdfFile.name;
            fileMeta.textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;

            // Show UI
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
     * Compress the PDF
     */
    async function compressPDF() {
        // Show progress
        actionSection.classList.add('hidden');
        optionsSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        progressSection.classList.remove('hidden');
        updateProgress(0, 'Starting compression...');

        const preset = COMPRESSION_PRESETS[compressionLevel.value];
        const quality = preset.quality;
        const scale = preset.scale;

        try {
            // Load original PDF with PDF.js for rendering
            const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer.slice(0) });
            const pdf = await loadingTask.promise;

            // Create new PDF document with pdf-lib
            const newPdf = await PDFDocument.create();

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                updateProgress(
                    Math.round((pageNum / totalPages) * 80),
                    `Compressing page ${pageNum} of ${totalPages}...`
                );

                // Get page and render to canvas
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Convert to JPEG
                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                const jpegBase64 = jpegDataUrl.split(',')[1];
                const jpegBytes = Uint8Array.from(atob(jpegBase64), c => c.charCodeAt(0));

                // Embed JPEG in new PDF
                const jpegImage = await newPdf.embedJpg(jpegBytes);

                // Add page with same dimensions as original viewport
                const newPage = newPdf.addPage([viewport.width, viewport.height]);
                newPage.drawImage(jpegImage, {
                    x: 0,
                    y: 0,
                    width: viewport.width,
                    height: viewport.height
                });
            }

            updateProgress(90, 'Generating PDF...');

            // Save the new PDF
            compressedPdfBytes = await newPdf.save();

            updateProgress(100, 'Complete!');

            // Show results
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');

                // Update stats
                const compressedSize = compressedPdfBytes.length;
                const reduction = ((originalSize - compressedSize) / originalSize) * 100;

                originalSizeEl.textContent = Utils.formatFileSize(originalSize);
                compressedSizeEl.textContent = Utils.formatFileSize(compressedSize);

                if (reduction > 0) {
                    reductionPercentEl.textContent = `-${reduction.toFixed(1)}%`;
                    reductionPercentEl.className = 'font-semibold text-primary-600';
                } else {
                    reductionPercentEl.textContent = `+${Math.abs(reduction).toFixed(1)}%`;
                    reductionPercentEl.className = 'font-semibold text-orange-600';
                }

                resultInfo.textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(compressedSize)}`;
            }, 500);

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
     * Update progress display
     * @param {number} percent - Progress percentage
     * @param {string} text - Status text
     */
    function updateProgress(percent, text) {
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressText.textContent = text;
    }

    /**
     * Download the compressed PDF
     */
    function downloadCompressedPDF() {
        if (!compressedPdfBytes) return;

        const baseName = pdfFile.name.replace(/\.pdf$/i, '');
        const filename = `${baseName}-compressed.pdf`;

        Utils.downloadFile(compressedPdfBytes, filename, 'application/pdf');
        Utils.showToast('Compressed PDF downloaded!', 'success');
    }

    /**
     * Reset the tool
     */
    function reset() {
        pdfFile = null;
        pdfArrayBuffer = null;
        totalPages = 0;
        compressedPdfBytes = null;
        originalSize = 0;

        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        optionsSection.classList.add('hidden');
        actionSection.classList.add('hidden');
        loadingSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }

})();

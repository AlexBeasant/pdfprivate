/**
 * Split PDF - Private PDF Tools
 * Extract specific pages from a PDF document
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

    // State
    let pdfFile = null;
    let pdfArrayBuffer = null;
    let pdfJsBuffer = null;  // Separate buffer for PDF.js (it detaches the buffer)
    let pdfDoc = null;
    let totalPages = 0;
    let selectedPages = new Set();
    let extractedPdfBytes = null;

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const selectionOptions = document.getElementById('selectionOptions');
    const pageRange = document.getElementById('pageRange');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const loadingSection = document.getElementById('loadingSection');
    const thumbnailSection = document.getElementById('thumbnailSection');
    const pageGrid = document.getElementById('pageGrid');
    const selectedCount = document.getElementById('selectedCount');
    const actionSection = document.getElementById('actionSection');
    const extractBtn = document.getElementById('extractBtn');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const resultInfo = document.getElementById('resultInfo');
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
    changeFileBtn.addEventListener('click', () => {
        reset();
    });

    pageRange.addEventListener('input', debounce(handlePageRangeInput, 300));

    selectAllBtn.addEventListener('click', () => {
        for (let i = 1; i <= totalPages; i++) {
            selectedPages.add(i);
        }
        updateSelection();
        pageRange.value = `1-${totalPages}`;
    });

    clearSelectionBtn.addEventListener('click', () => {
        selectedPages.clear();
        updateSelection();
        pageRange.value = '';
    });

    extractBtn.addEventListener('click', extractPages);
    downloadBtn.addEventListener('click', downloadExtractedPDF);
    processAnotherBtn.addEventListener('click', reset);

    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Handle uploaded file
     * @param {File[]} files - Array of uploaded files
     */
    async function handleFile(files) {
        if (files.length === 0) return;

        pdfFile = files[0];

        try {
            // Show loading
            dropZone.classList.add('hidden');
            loadingSection.classList.remove('hidden');

            // Read file
            const originalBuffer = await Utils.readFileAsArrayBuffer(pdfFile);

            // Create separate copies for each library (they detach the buffer)
            pdfArrayBuffer = originalBuffer.slice(0);
            pdfJsBuffer = originalBuffer.slice(0);

            // Load with pdf-lib to get page count
            pdfDoc = await PDFDocument.load(pdfArrayBuffer);
            totalPages = pdfDoc.getPageCount();

            // Update file info
            fileName.textContent = pdfFile.name;
            fileMeta.textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;

            // Render thumbnails
            await renderThumbnails();

            // Show UI
            loadingSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            selectionOptions.classList.remove('hidden');
            thumbnailSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');

        } catch (error) {
            console.error('Error loading PDF:', error);
            Utils.showToast('Failed to load PDF. Make sure it\'s a valid PDF file.', 'error');
            loadingSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
        }
    }

    /**
     * Render page thumbnails using PDF.js
     */
    async function renderThumbnails() {
        const loadingTask = pdfjsLib.getDocument({ data: pdfJsBuffer });
        const pdf = await loadingTask.promise;

        pageGrid.innerHTML = '';

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            // Create thumbnail container
            const thumbnail = document.createElement('div');
            thumbnail.className = 'page-thumbnail';
            thumbnail.dataset.page = pageNum;

            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Calculate scale for thumbnail
            const viewport = page.getViewport({ scale: 0.5 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render page
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Add page number label
            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-number';
            pageLabel.textContent = `Page ${pageNum}`;

            // Add selection indicator
            const selectIndicator = document.createElement('div');
            selectIndicator.className = 'select-indicator';
            selectIndicator.innerHTML = `
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
            `;

            thumbnail.appendChild(canvas);
            thumbnail.appendChild(pageLabel);
            thumbnail.appendChild(selectIndicator);

            // Click handler
            thumbnail.addEventListener('click', () => togglePageSelection(pageNum));

            pageGrid.appendChild(thumbnail);
        }
    }

    /**
     * Toggle page selection
     * @param {number} pageNum - Page number to toggle
     */
    function togglePageSelection(pageNum) {
        if (selectedPages.has(pageNum)) {
            selectedPages.delete(pageNum);
        } else {
            selectedPages.add(pageNum);
        }
        updateSelection();
        updatePageRangeInput();
    }

    /**
     * Update the visual selection state
     */
    function updateSelection() {
        const thumbnails = pageGrid.querySelectorAll('.page-thumbnail');
        thumbnails.forEach(thumb => {
            const pageNum = parseInt(thumb.dataset.page);
            if (selectedPages.has(pageNum)) {
                thumb.classList.add('selected');
            } else {
                thumb.classList.remove('selected');
            }
        });

        selectedCount.textContent = selectedPages.size;
        extractBtn.disabled = selectedPages.size === 0;
    }

    /**
     * Update page range input based on selection
     */
    function updatePageRangeInput() {
        if (selectedPages.size === 0) {
            pageRange.value = '';
            return;
        }

        const sorted = Array.from(selectedPages).sort((a, b) => a - b);
        const ranges = [];
        let start = sorted[0];
        let end = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = sorted[i];
                end = sorted[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);

        pageRange.value = ranges.join(', ');
    }

    /**
     * Handle page range input
     */
    function handlePageRangeInput() {
        const value = pageRange.value.trim();
        if (!value) {
            selectedPages.clear();
            updateSelection();
            return;
        }

        const newSelection = parsePageRange(value);
        selectedPages = newSelection;
        updateSelection();
    }

    /**
     * Parse page range string into a Set of page numbers
     * @param {string} rangeStr - Page range string (e.g., "1-3, 5, 7-10")
     * @returns {Set<number>} Set of page numbers
     */
    function parsePageRange(rangeStr) {
        const pages = new Set();
        const parts = rangeStr.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            if (trimmed.includes('-')) {
                const [startStr, endStr] = trimmed.split('-');
                const start = parseInt(startStr.trim());
                const end = parseInt(endStr.trim());

                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
                        pages.add(i);
                    }
                }
            } else {
                const pageNum = parseInt(trimmed);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    pages.add(pageNum);
                }
            }
        }

        return pages;
    }

    /**
     * Extract selected pages
     */
    async function extractPages() {
        if (selectedPages.size === 0) {
            Utils.showToast('Please select at least one page', 'error');
            return;
        }

        // Show progress
        actionSection.classList.add('hidden');
        thumbnailSection.classList.add('hidden');
        selectionOptions.classList.add('hidden');
        progressSection.classList.remove('hidden');
        updateProgress(0, 'Starting extraction...');

        try {
            const newPdf = await PDFDocument.create();
            const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);

            for (let i = 0; i < sortedPages.length; i++) {
                const pageNum = sortedPages[i];
                updateProgress(
                    Math.round((i / sortedPages.length) * 80),
                    `Extracting page ${pageNum}...`
                );

                // pdf-lib uses 0-based indexing
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
                newPdf.addPage(copiedPage);
            }

            updateProgress(90, 'Generating PDF...');
            extractedPdfBytes = await newPdf.save();

            updateProgress(100, 'Complete!');

            // Show result
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');

                const totalSize = Utils.formatFileSize(extractedPdfBytes.length);
                resultInfo.textContent = `${sortedPages.length} page${sortedPages.length !== 1 ? 's' : ''} • ${totalSize}`;
            }, 500);

        } catch (error) {
            console.error('Extraction error:', error);
            Utils.showToast('Failed to extract pages. Please try again.', 'error');
            progressSection.classList.add('hidden');
            thumbnailSection.classList.remove('hidden');
            selectionOptions.classList.remove('hidden');
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
     * Download the extracted PDF
     */
    function downloadExtractedPDF() {
        if (!extractedPdfBytes) return;

        const baseName = pdfFile.name.replace(/\.pdf$/i, '');
        const filename = `${baseName}-extracted.pdf`;

        Utils.downloadFile(extractedPdfBytes, filename, 'application/pdf');
        Utils.showToast('PDF downloaded successfully!', 'success');
    }

    /**
     * Reset the tool for another split
     */
    function reset() {
        pdfFile = null;
        pdfArrayBuffer = null;
        pdfJsBuffer = null;
        pdfDoc = null;
        totalPages = 0;
        selectedPages.clear();
        extractedPdfBytes = null;

        pageRange.value = '';
        pageGrid.innerHTML = '';

        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        selectionOptions.classList.add('hidden');
        thumbnailSection.classList.add('hidden');
        actionSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }

})();

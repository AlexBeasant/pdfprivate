/**
 * Merge PDFs - Private PDF Tools
 * Combines multiple PDF files into a single document
 */

(function() {
    'use strict';

    // Check if dependencies are loaded
    if (typeof window.PDFTools === 'undefined') {
        console.error('PDFTools not loaded. Make sure app.js is loaded before this script.');
        return;
    }

    if (typeof PDFLib === 'undefined') {
        console.error('pdf-lib not loaded. Make sure pdf-lib is loaded before this script.');
        return;
    }

    const { Utils, DragDropZone, SortableList } = window.PDFTools;
    const { PDFDocument } = PDFLib;

    // State
    let files = [];
    let mergedPdfBytes = null;

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileListSection = document.getElementById('fileListSection');
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const actionSection = document.getElementById('actionSection');
    const mergeBtn = document.getElementById('mergeBtn');
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
        multiple: true,
        onFiles: handleFiles,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    // Initialize sortable list
    let sortable = null;

    // Event Listeners
    clearAllBtn.addEventListener('click', clearAll);
    mergeBtn.addEventListener('click', mergePDFs);
    downloadBtn.addEventListener('click', downloadMergedPDF);
    processAnotherBtn.addEventListener('click', reset);

    /**
     * Handle uploaded files
     * @param {File[]} newFiles - Array of uploaded files
     */
    async function handleFiles(newFiles) {
        for (const file of newFiles) {
            // Check if file is already added
            if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
                Utils.showToast(`${file.name} is already added`, 'error');
                continue;
            }

            try {
                // Read PDF to get page count
                const originalBuffer = await Utils.readFileAsArrayBuffer(file);
                // Make a copy for initial load (pdf-lib may detach the buffer)
                const previewBuffer = originalBuffer.slice(0);
                const pdfDoc = await PDFDocument.load(previewBuffer);
                const pageCount = pdfDoc.getPageCount();

                files.push({
                    id: Utils.generateId(),
                    file: file,
                    pageCount: pageCount,
                    // Store a fresh copy for later use during merge
                    arrayBuffer: originalBuffer.slice(0)
                });
            } catch (error) {
                Utils.showToast(`Failed to read ${file.name}. Make sure it's a valid PDF.`, 'error');
                console.error('Error loading PDF:', error);
            }
        }

        updateUI();
    }

    /**
     * Update the UI based on current state
     */
    function updateUI() {
        fileCount.textContent = files.length;

        if (files.length === 0) {
            fileListSection.classList.add('hidden');
            actionSection.classList.add('hidden');
            dropZone.classList.remove('has-files');
            return;
        }

        dropZone.classList.add('has-files');
        fileListSection.classList.remove('hidden');
        actionSection.classList.remove('hidden');

        // Render file list
        fileList.innerHTML = files.map((f, index) => `
            <li class="file-item" data-id="${f.id}">
                <div class="drag-handle" title="Drag to reorder">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                </div>
                <div class="file-info">
                    <div class="file-name">${f.file.name}</div>
                    <div class="file-meta">
                        ${Utils.formatFileSize(f.file.size)} • ${f.pageCount} page${f.pageCount !== 1 ? 's' : ''}
                    </div>
                </div>
                <button class="remove-btn" data-id="${f.id}" title="Remove file">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </li>
        `).join('');

        // Initialize sortable if not already
        if (!sortable) {
            sortable = new SortableList(fileList, {
                onReorder: handleReorder
            });
        }

        // Add remove button listeners
        fileList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(btn.dataset.id);
            });
        });

        // Update merge button state
        mergeBtn.disabled = files.length < 2;
        if (files.length < 2) {
            mergeBtn.title = 'Add at least 2 PDFs to merge';
        } else {
            mergeBtn.title = '';
        }
    }

    /**
     * Handle file reordering
     * @param {string[]} newOrder - Array of file IDs in new order
     */
    function handleReorder(newOrder) {
        const reorderedFiles = newOrder.map(id => files.find(f => f.id === id)).filter(Boolean);
        files = reorderedFiles;
    }

    /**
     * Remove a file from the list
     * @param {string} id - File ID to remove
     */
    function removeFile(id) {
        files = files.filter(f => f.id !== id);
        updateUI();
    }

    /**
     * Clear all files
     */
    function clearAll() {
        files = [];
        updateUI();
    }

    /**
     * Merge all PDFs
     */
    async function mergePDFs() {
        if (files.length < 2) {
            Utils.showToast('Add at least 2 PDFs to merge', 'error');
            return;
        }

        // Show progress
        actionSection.classList.add('hidden');
        progressSection.classList.remove('hidden');
        updateProgress(0, 'Starting merge...');

        try {
            const mergedPdf = await PDFDocument.create();
            const totalPages = files.reduce((sum, f) => sum + f.pageCount, 0);
            let processedPages = 0;

            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                updateProgress(
                    Math.round((i / files.length) * 50),
                    `Processing ${f.file.name}...`
                );

                const pdfDoc = await PDFDocument.load(f.arrayBuffer);
                const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());

                for (const page of pages) {
                    mergedPdf.addPage(page);
                    processedPages++;
                    updateProgress(
                        Math.round(50 + (processedPages / totalPages) * 40),
                        `Adding page ${processedPages} of ${totalPages}...`
                    );
                }
            }

            updateProgress(95, 'Generating PDF...');
            mergedPdfBytes = await mergedPdf.save();

            updateProgress(100, 'Complete!');

            // Show result
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');

                const totalSize = Utils.formatFileSize(mergedPdfBytes.length);
                resultInfo.textContent = `${totalPages} pages • ${totalSize}`;
            }, 500);

        } catch (error) {
            console.error('Merge error:', error);
            Utils.showToast('Failed to merge PDFs. Please try again.', 'error');
            progressSection.classList.add('hidden');
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
     * Download the merged PDF
     */
    function downloadMergedPDF() {
        if (!mergedPdfBytes) return;

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `merged-${timestamp}.pdf`;

        Utils.downloadFile(mergedPdfBytes, filename, 'application/pdf');
        Utils.showToast('PDF downloaded successfully!', 'success');
    }

    /**
     * Reset the tool for another merge
     */
    function reset() {
        files = [];
        mergedPdfBytes = null;
        sortable = null;

        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        updateUI();
    }

})();

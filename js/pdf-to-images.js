/**
 * PDF to Images - Private PDF Tools
 * Convert PDF pages to images
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

    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

    const { Utils, DragDropZone } = window.PDFTools;

    // State
    let pdfFile = null;
    let pdfArrayBuffer = null;
    let totalPages = 0;
    let convertedImages = [];

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const optionsSection = document.getElementById('optionsSection');
    const imageFormat = document.getElementById('imageFormat');
    const imageScale = document.getElementById('imageScale');
    const jpegQualityGroup = document.getElementById('jpegQualityGroup');
    const jpegQuality = document.getElementById('jpegQuality');
    const jpegQualityValue = document.getElementById('jpegQualityValue');
    const loadingSection = document.getElementById('loadingSection');
    const actionSection = document.getElementById('actionSection');
    const convertBtn = document.getElementById('convertBtn');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const imageCount = document.getElementById('imageCount');
    const imageGrid = document.getElementById('imageGrid');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
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

    imageFormat.addEventListener('change', () => {
        jpegQualityGroup.classList.toggle('hidden', imageFormat.value !== 'jpeg');
    });

    jpegQuality.addEventListener('input', () => {
        jpegQualityValue.textContent = Math.round(jpegQuality.value * 100) + '%';
    });

    convertBtn.addEventListener('click', convertToImages);
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
    processAnotherBtn.addEventListener('click', reset);

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

            // Read file and make a copy (PDF.js detaches the buffer after use)
            const originalBuffer = await Utils.readFileAsArrayBuffer(pdfFile);
            pdfArrayBuffer = originalBuffer.slice(0);

            // Load with PDF.js to get page count (use a copy)
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
     * Convert PDF pages to images
     */
    async function convertToImages() {
        // Show progress
        actionSection.classList.add('hidden');
        optionsSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        progressSection.classList.remove('hidden');
        updateProgress(0, 'Starting conversion...');

        convertedImages = [];
        const format = imageFormat.value;
        const scale = parseFloat(imageScale.value);
        const quality = parseFloat(jpegQuality.value);

        try {
            const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
            const pdf = await loadingTask.promise;

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                updateProgress(
                    Math.round((pageNum / totalPages) * 90),
                    `Converting page ${pageNum} of ${totalPages}...`
                );

                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });

                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render page
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Convert to data URL
                const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
                const dataUrl = canvas.toDataURL(mimeType, format === 'jpeg' ? quality : undefined);

                // Convert data URL to Blob for file size calculation
                const response = await fetch(dataUrl);
                const blob = await response.blob();

                convertedImages.push({
                    pageNum: pageNum,
                    dataUrl: dataUrl,
                    blob: blob,
                    width: canvas.width,
                    height: canvas.height,
                    format: format,
                    size: blob.size
                });
            }

            updateProgress(100, 'Complete!');

            // Show results
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
                renderImageGrid();
            }, 500);

        } catch (error) {
            console.error('Conversion error:', error);
            Utils.showToast('Failed to convert PDF. Please try again.', 'error');
            progressSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            optionsSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        }
    }

    /**
     * Render the image grid
     */
    function renderImageGrid() {
        imageCount.textContent = convertedImages.length;

        imageGrid.innerHTML = convertedImages.map(img => `
            <div class="image-preview">
                <img src="${img.dataUrl}" alt="Page ${img.pageNum}">
                <button class="download-btn" data-page="${img.pageNum}" title="Download this image">
                    <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                </button>
                <div class="image-info">
                    <div class="image-name">Page ${img.pageNum}</div>
                    <div class="image-size">${img.width} x ${img.height} • ${Utils.formatFileSize(img.size)}</div>
                </div>
            </div>
        `).join('');

        // Add download button listeners
        imageGrid.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pageNum = parseInt(btn.dataset.page);
                downloadSingleImage(pageNum);
            });
        });
    }

    /**
     * Download a single image
     * @param {number} pageNum - Page number to download
     */
    function downloadSingleImage(pageNum) {
        const img = convertedImages.find(i => i.pageNum === pageNum);
        if (!img) return;

        const baseName = pdfFile.name.replace(/\.pdf$/i, '');
        const extension = img.format === 'jpeg' ? 'jpg' : 'png';
        const filename = `${baseName}-page-${pageNum}.${extension}`;

        Utils.downloadFile(img.blob, filename, img.blob.type);
        Utils.showToast('Image downloaded!', 'success');
    }

    /**
     * Download all images as a ZIP file
     */
    async function downloadAllAsZip() {
        Utils.showToast('Creating ZIP file...', 'info');

        try {
            const zip = new JSZip();
            const baseName = pdfFile.name.replace(/\.pdf$/i, '');
            const extension = convertedImages[0]?.format === 'jpeg' ? 'jpg' : 'png';

            for (const img of convertedImages) {
                const filename = `${baseName}-page-${img.pageNum}.${extension}`;
                // Convert data URL to base64
                const base64Data = img.dataUrl.split(',')[1];
                zip.file(filename, base64Data, { base64: true });
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipFilename = `${baseName}-images.zip`;

            Utils.downloadFile(zipBlob, zipFilename, 'application/zip');
            Utils.showToast('ZIP downloaded successfully!', 'success');

        } catch (error) {
            console.error('ZIP creation error:', error);
            Utils.showToast('Failed to create ZIP file', 'error');
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
     * Reset the tool
     */
    function reset() {
        pdfFile = null;
        pdfArrayBuffer = null;
        totalPages = 0;
        convertedImages = [];

        imageGrid.innerHTML = '';

        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        fileInfo.classList.add('hidden');
        optionsSection.classList.add('hidden');
        actionSection.classList.add('hidden');
        loadingSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }

})();

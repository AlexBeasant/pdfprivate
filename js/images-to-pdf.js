/**
 * Images to PDF - Private PDF Tools
 * Convert images to a PDF document
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

    // Page size constants (in points, 72 points = 1 inch)
    const PAGE_SIZES = {
        a4: { width: 595.28, height: 841.89 },
        letter: { width: 612, height: 792 },
        legal: { width: 612, height: 1008 }
    };

    // State
    let images = [];
    let pdfBytes = null;

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const imageListSection = document.getElementById('imageListSection');
    const imageList = document.getElementById('imageList');
    const imageCount = document.getElementById('imageCount');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const optionsSection = document.getElementById('optionsSection');
    const pageSize = document.getElementById('pageSize');
    const orientation = document.getElementById('orientation');
    const margin = document.getElementById('margin');
    const actionSection = document.getElementById('actionSection');
    const createPdfBtn = document.getElementById('createPdfBtn');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const resultInfo = document.getElementById('resultInfo');
    const downloadBtn = document.getElementById('downloadBtn');
    const processAnotherBtn = document.getElementById('processAnotherBtn');

    // Initialize drag and drop for main zone
    new DragDropZone(dropZone, {
        accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
        multiple: true,
        onFiles: handleImages,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    // Initialize sortable list
    let sortable = null;

    // Event Listeners
    addMoreBtn.addEventListener('click', openFilePicker);
    clearAllBtn.addEventListener('click', clearAll);
    createPdfBtn.addEventListener('click', createPdf);
    downloadBtn.addEventListener('click', downloadPdf);
    processAnotherBtn.addEventListener('click', reset);

    /**
     * Open file picker for adding more images
     */
    function openFilePicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.multiple = true;
        input.onchange = (e) => {
            handleImages(Array.from(e.target.files));
        };
        input.click();
    }

    /**
     * Handle uploaded images
     * @param {File[]} files - Array of image files
     */
    async function handleImages(files) {
        for (const file of files) {
            // Check if image is already added
            if (images.some(img => img.file.name === file.name && img.file.size === file.size)) {
                Utils.showToast(`${file.name} is already added`, 'error');
                continue;
            }

            try {
                // Read image as data URL for preview
                const dataUrl = await Utils.readFileAsDataURL(file);

                // Get image dimensions
                const dimensions = await getImageDimensions(dataUrl);

                images.push({
                    id: Utils.generateId(),
                    file: file,
                    dataUrl: dataUrl,
                    width: dimensions.width,
                    height: dimensions.height
                });
            } catch (error) {
                Utils.showToast(`Failed to load ${file.name}`, 'error');
                console.error('Error loading image:', error);
            }
        }

        updateUI();
    }

    /**
     * Get image dimensions
     * @param {string} dataUrl - Image data URL
     * @returns {Promise<{width: number, height: number}>}
     */
    function getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Update the UI based on current state
     */
    function updateUI() {
        imageCount.textContent = images.length;

        if (images.length === 0) {
            imageListSection.classList.add('hidden');
            optionsSection.classList.add('hidden');
            actionSection.classList.add('hidden');
            dropZone.classList.remove('has-files');
            return;
        }

        dropZone.classList.add('has-files');
        imageListSection.classList.remove('hidden');
        optionsSection.classList.remove('hidden');
        actionSection.classList.remove('hidden');

        // Render image list
        imageList.innerHTML = images.map((img) => `
            <li class="file-item" data-id="${img.id}">
                <div class="drag-handle" title="Drag to reorder">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                </div>
                <div class="w-12 h-12 flex-shrink-0 ml-2 rounded overflow-hidden bg-gray-100">
                    <img src="${img.dataUrl}" alt="${Utils.escapeHtml(img.file.name)}" class="w-full h-full object-cover">
                </div>
                <div class="file-info">
                    <div class="file-name">${Utils.escapeHtml(img.file.name)}</div>
                    <div class="file-meta">
                        ${img.width} x ${img.height} px • ${Utils.formatFileSize(img.file.size)}
                    </div>
                </div>
                <button class="remove-btn" data-id="${img.id}" title="Remove image">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </li>
        `).join('');

        // Initialize sortable if not already
        if (!sortable) {
            sortable = new SortableList(imageList, {
                onReorder: handleReorder
            });
        }

        // Add remove button listeners
        imageList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeImage(btn.dataset.id);
            });
        });
    }

    /**
     * Handle image reordering
     * @param {string[]} newOrder - Array of image IDs in new order
     */
    function handleReorder(newOrder) {
        const reorderedImages = newOrder.map(id => images.find(img => img.id === id)).filter(Boolean);
        images = reorderedImages;
    }

    /**
     * Remove an image from the list
     * @param {string} id - Image ID to remove
     */
    function removeImage(id) {
        images = images.filter(img => img.id !== id);
        updateUI();
    }

    /**
     * Clear all images
     */
    function clearAll() {
        images = [];
        sortable = null;
        updateUI();
    }

    /**
     * Create PDF from images
     */
    async function createPdf() {
        if (images.length === 0) {
            Utils.showToast('Please add at least one image', 'error');
            return;
        }

        // Show progress
        actionSection.classList.add('hidden');
        optionsSection.classList.add('hidden');
        imageListSection.classList.add('hidden');
        progressSection.classList.remove('hidden');
        updateProgress(0, 'Creating PDF...');

        try {
            const pdfDoc = await PDFDocument.create();
            const selectedPageSize = pageSize.value;
            const selectedOrientation = orientation.value;
            const selectedMargin = parseInt(margin.value);

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                updateProgress(
                    Math.round((i / images.length) * 80),
                    `Processing image ${i + 1} of ${images.length}...`
                );

                // Embed image
                const imageBytes = await Utils.readFileAsArrayBuffer(img.file);
                let embeddedImage;

                if (img.file.type === 'image/jpeg' || img.file.name.toLowerCase().endsWith('.jpg') || img.file.name.toLowerCase().endsWith('.jpeg')) {
                    embeddedImage = await pdfDoc.embedJpg(imageBytes);
                } else if (img.file.type === 'image/png' || img.file.name.toLowerCase().endsWith('.png')) {
                    embeddedImage = await pdfDoc.embedPng(imageBytes);
                } else {
                    // For WebP, convert to PNG first using canvas
                    const pngDataUrl = await convertToPng(img.dataUrl);
                    const pngBytes = dataUrlToArrayBuffer(pngDataUrl);
                    embeddedImage = await pdfDoc.embedPng(pngBytes);
                }

                // Calculate page dimensions
                let pageWidth, pageHeight;

                if (selectedPageSize === 'fit') {
                    // Fit page to image
                    pageWidth = img.width + (selectedMargin * 2);
                    pageHeight = img.height + (selectedMargin * 2);
                } else {
                    // Use standard page size
                    const size = PAGE_SIZES[selectedPageSize];
                    let usePortrait;

                    if (selectedOrientation === 'auto') {
                        // Auto: use portrait if image is taller than wide
                        usePortrait = img.height >= img.width;
                    } else {
                        usePortrait = selectedOrientation === 'portrait';
                    }

                    if (usePortrait) {
                        pageWidth = size.width;
                        pageHeight = size.height;
                    } else {
                        pageWidth = size.height;
                        pageHeight = size.width;
                    }
                }

                // Add page
                const page = pdfDoc.addPage([pageWidth, pageHeight]);

                // Calculate image dimensions to fit within page (with margin)
                const availableWidth = pageWidth - (selectedMargin * 2);
                const availableHeight = pageHeight - (selectedMargin * 2);

                let drawWidth = img.width;
                let drawHeight = img.height;

                if (selectedPageSize !== 'fit') {
                    // Scale image to fit within available space
                    const widthRatio = availableWidth / img.width;
                    const heightRatio = availableHeight / img.height;
                    const scale = Math.min(widthRatio, heightRatio, 1);

                    drawWidth = img.width * scale;
                    drawHeight = img.height * scale;
                }

                // Center image on page
                const x = (pageWidth - drawWidth) / 2;
                const y = (pageHeight - drawHeight) / 2;

                page.drawImage(embeddedImage, {
                    x: x,
                    y: y,
                    width: drawWidth,
                    height: drawHeight
                });
            }

            updateProgress(90, 'Generating PDF...');
            pdfBytes = await pdfDoc.save();

            updateProgress(100, 'Complete!');

            // Show result
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');

                const totalSize = Utils.formatFileSize(pdfBytes.length);
                resultInfo.textContent = `${images.length} page${images.length !== 1 ? 's' : ''} • ${totalSize}`;
            }, 500);

        } catch (error) {
            console.error('PDF creation error:', error);
            Utils.showToast('Failed to create PDF. Please try again.', 'error');
            progressSection.classList.add('hidden');
            imageListSection.classList.remove('hidden');
            optionsSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        }
    }

    /**
     * Convert image to PNG using canvas
     * @param {string} dataUrl - Image data URL
     * @returns {Promise<string>} PNG data URL
     */
    function convertToPng(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Convert data URL to ArrayBuffer
     * @param {string} dataUrl - Data URL
     * @returns {Uint8Array}
     */
    function dataUrlToArrayBuffer(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
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
     * Download the PDF
     */
    function downloadPdf() {
        if (!pdfBytes) return;

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `images-${timestamp}.pdf`;

        Utils.downloadFile(pdfBytes, filename, 'application/pdf');
        Utils.showToast('PDF downloaded successfully!', 'success');
    }

    /**
     * Reset the tool
     */
    function reset() {
        images = [];
        pdfBytes = null;
        sortable = null;

        resultSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        updateUI();
    }

})();

/**
 * Delete PDF Pages - Private PDF Tools
 * Remove unwanted pages. Remaining pages are copied unchanged (lossless).
 */

(function() {
    'use strict';

    if (typeof window.PDFTools === 'undefined' || typeof pdfjsLib === 'undefined' || typeof PDFLib === 'undefined') {
        console.error('Delete pages: required libraries not loaded.');
        return;
    }

    const { Utils, DragDropZone, renderPageThumbnails, parsePageRange, formatPageRange } = window.PDFTools;
    const { PDFDocument } = PDFLib;

    let pdfFile = null;
    let pdfBytes = null;
    let totalPages = 0;
    let marked = new Set();
    let thumbs = [];
    let outputBytes = null;
    let keptCount = 0;

    const $ = (id) => document.getElementById(id);
    const dropZone = $('dropZone');
    const fileInfo = $('fileInfo');
    const loadingSection = $('loadingSection');
    const selectionOptions = $('selectionOptions');
    const pageRange = $('pageRange');
    const thumbnailSection = $('thumbnailSection');
    const pageGrid = $('pageGrid');
    const actionSection = $('actionSection');
    const deleteBtn = $('deleteBtn');
    const progressSection = $('progressSection');
    const resultSection = $('resultSection');

    new DragDropZone(dropZone, {
        accept: '.pdf,application/pdf',
        multiple: false,
        onFiles: handleFile,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    $('changeFileBtn').addEventListener('click', reset);
    $('clearSelectionBtn').addEventListener('click', () => { marked.clear(); pageRange.value = ''; updateView(); });
    pageRange.addEventListener('input', () => { marked = parsePageRange(pageRange.value, totalPages); updateView(); });
    deleteBtn.addEventListener('click', deletePages);
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

            const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
            totalPages = pdf.numPages;

            $('fileName').textContent = pdfFile.name;
            $('fileMeta').textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;

            thumbs = await renderPageThumbnails(pdf, pageGrid, {
                onClick: (pageNum) => {
                    if (marked.has(pageNum)) marked.delete(pageNum); else marked.add(pageNum);
                    pageRange.value = formatPageRange(marked);
                    updateView();
                },
                onProgress: (done, total) => { $('loadingText').textContent = `Loading page ${done} of ${total}...`; }
            });
            updateView();

            loadingSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            selectionOptions.classList.remove('hidden');
            thumbnailSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading PDF:', error);
            Utils.showToast('Failed to load PDF. Make sure it\'s a valid PDF file.', 'error');
            reset();
        }
    }

    function updateView() {
        thumbs.forEach((thumb, i) => thumb.classList.toggle('marked-delete', marked.has(i + 1)));
        $('selectedCount').textContent = marked.size;
        const all = marked.size >= totalPages;
        deleteBtn.disabled = marked.size === 0 || all;
        if (all) {
            deleteBtn.textContent = 'You can\'t delete every page';
        } else if (marked.size === 0) {
            deleteBtn.textContent = 'Delete selected pages';
        } else {
            deleteBtn.textContent = `Delete ${marked.size} page${marked.size === 1 ? '' : 's'}`;
        }
    }

    async function deletePages() {
        if (marked.size === 0 || marked.size >= totalPages) return;
        actionSection.classList.add('hidden');
        selectionOptions.classList.add('hidden');
        thumbnailSection.classList.add('hidden');
        progressSection.classList.remove('hidden');
        setProgress(30, 'Removing pages...');
        try {
            const doc = await PDFDocument.load(pdfBytes);
            // Remove from the end so earlier indices stay valid
            Array.from(marked).sort((a, b) => b - a).forEach(p => doc.removePage(p - 1));
            keptCount = doc.getPageCount();
            setProgress(80, 'Saving PDF...');
            outputBytes = await doc.save();
            setProgress(100, 'Complete!');
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
                $('resultInfo').textContent = `${marked.size} page${marked.size !== 1 ? 's' : ''} removed • ${keptCount} page${keptCount !== 1 ? 's' : ''} left • ${Utils.formatFileSize(outputBytes.length)}`;
            }, 300);
        } catch (error) {
            console.error('Delete error:', error);
            Utils.showToast(error.message && error.message.includes('encrypted')
                ? 'This PDF is password-protected. Unlock it first.'
                : 'Failed to delete pages. Please try again.', 'error');
            progressSection.classList.add('hidden');
            selectionOptions.classList.remove('hidden');
            thumbnailSection.classList.remove('hidden');
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
        Utils.downloadFile(outputBytes, `${pdfFile.name.replace(/\.pdf$/i, '')}-edited.pdf`, 'application/pdf');
        Utils.showToast('PDF downloaded!', 'success');
    }

    function reset() {
        pdfFile = null; pdfBytes = null; totalPages = 0; marked = new Set(); thumbs = []; outputBytes = null;
        pageGrid.innerHTML = '';
        pageRange.value = '';
        [fileInfo, loadingSection, selectionOptions, thumbnailSection, actionSection, progressSection, resultSection]
            .forEach(el => el.classList.add('hidden'));
        dropZone.classList.remove('hidden');
    }
})();

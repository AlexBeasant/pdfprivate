/**
 * Rotate PDF - Private PDF Tools
 * Rotate individual pages or the whole document. Lossless: only the
 * page rotation flag changes, so text and images keep full quality.
 */

(function() {
    'use strict';

    if (typeof window.PDFTools === 'undefined' || typeof pdfjsLib === 'undefined' || typeof PDFLib === 'undefined') {
        console.error('Rotate PDF: required libraries not loaded.');
        return;
    }

    const { Utils, DragDropZone, renderPageThumbnails } = window.PDFTools;
    const { PDFDocument, degrees } = PDFLib;

    let pdfFile = null;
    let pdfBytes = null;
    let totalPages = 0;
    let rotations = []; // extra rotation per page (0, 90, 180, 270), index = page - 1
    let thumbs = [];
    let outputBytes = null;

    const $ = (id) => document.getElementById(id);
    const dropZone = $('dropZone');
    const fileInfo = $('fileInfo');
    const loadingSection = $('loadingSection');
    const controlsSection = $('controlsSection');
    const thumbnailSection = $('thumbnailSection');
    const pageGrid = $('pageGrid');
    const actionSection = $('actionSection');
    const saveBtn = $('saveBtn');
    const progressSection = $('progressSection');
    const resultSection = $('resultSection');

    new DragDropZone(dropZone, {
        accept: '.pdf,application/pdf',
        multiple: false,
        onFiles: handleFile,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    $('changeFileBtn').addEventListener('click', reset);
    $('rotateAllLeftBtn').addEventListener('click', () => rotateAll(-90));
    $('rotateAllRightBtn').addEventListener('click', () => rotateAll(90));
    $('resetRotationBtn').addEventListener('click', () => { rotations = rotations.map(() => 0); updateView(); });
    saveBtn.addEventListener('click', save);
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
            rotations = new Array(totalPages).fill(0);

            $('fileName').textContent = pdfFile.name;
            $('fileMeta').textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;

            thumbs = await renderPageThumbnails(pdf, pageGrid, {
                onClick: (pageNum) => { rotations[pageNum - 1] = (rotations[pageNum - 1] + 90) % 360; updateView(); },
                onProgress: (done, total) => { $('loadingText').textContent = `Loading page ${done} of ${total}...`; }
            });
            updateView();

            loadingSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            controlsSection.classList.remove('hidden');
            thumbnailSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading PDF:', error);
            Utils.showToast('Failed to load PDF. Make sure it\'s a valid PDF file.', 'error');
            reset();
        }
    }

    function rotateAll(delta) {
        rotations = rotations.map(r => (r + delta + 360) % 360);
        updateView();
    }

    function updateView() {
        thumbs.forEach((thumb, i) => {
            const canvas = thumb.querySelector('canvas');
            canvas.style.transform = `rotate(${rotations[i]}deg)`;
            thumb.classList.toggle('selected', rotations[i] !== 0);
        });
        const changed = rotations.filter(r => r !== 0).length;
        $('rotatedCount').textContent = changed;
        saveBtn.disabled = changed === 0;
    }

    async function save() {
        actionSection.classList.add('hidden');
        controlsSection.classList.add('hidden');
        thumbnailSection.classList.add('hidden');
        progressSection.classList.remove('hidden');
        setProgress(30, 'Applying rotation...');
        try {
            const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
            doc.getPages().forEach((page, i) => {
                if (rotations[i]) {
                    const current = page.getRotation().angle || 0;
                    page.setRotation(degrees((current + rotations[i]) % 360));
                }
            });
            setProgress(80, 'Saving PDF...');
            outputBytes = await doc.save();
            setProgress(100, 'Complete!');
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
                $('resultInfo').textContent = `${totalPages} page${totalPages !== 1 ? 's' : ''} • ${Utils.formatFileSize(outputBytes.length)}`;
            }, 300);
        } catch (error) {
            console.error('Rotate error:', error);
            Utils.showToast(error.message && error.message.includes('encrypted')
                ? 'This PDF is password-protected. Unlock it first.'
                : 'Failed to rotate PDF. Please try again.', 'error');
            progressSection.classList.add('hidden');
            controlsSection.classList.remove('hidden');
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
        Utils.downloadFile(outputBytes, `${pdfFile.name.replace(/\.pdf$/i, '')}-rotated.pdf`, 'application/pdf');
        Utils.showToast('Rotated PDF downloaded!', 'success');
    }

    function reset() {
        pdfFile = null; pdfBytes = null; totalPages = 0; rotations = []; thumbs = []; outputBytes = null;
        pageGrid.innerHTML = '';
        [fileInfo, loadingSection, controlsSection, thumbnailSection, actionSection, progressSection, resultSection]
            .forEach(el => el.classList.add('hidden'));
        dropZone.classList.remove('hidden');
    }
})();

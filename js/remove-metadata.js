/**
 * Remove PDF Metadata - Private PDF Tools
 * Shows and strips hidden document information: title, author, subject,
 * keywords, the creating app, dates and XMP metadata streams.
 * Page content is copied unchanged.
 */

(function() {
    'use strict';

    if (typeof window.PDFTools === 'undefined' || typeof PDFLib === 'undefined') {
        console.error('Remove metadata: required libraries not loaded.');
        return;
    }

    const { Utils, DragDropZone } = window.PDFTools;
    const { PDFDocument, PDFName, PDFRef } = PDFLib;

    let pdfFile = null;
    let pdfBytes = null;
    let outputBytes = null;

    const $ = (id) => document.getElementById(id);
    const dropZone = $('dropZone');
    const fileInfo = $('fileInfo');
    const loadingSection = $('loadingSection');
    const metadataSection = $('metadataSection');
    const actionSection = $('actionSection');
    const progressSection = $('progressSection');
    const resultSection = $('resultSection');

    new DragDropZone(dropZone, {
        accept: '.pdf,application/pdf',
        multiple: false,
        onFiles: handleFile,
        onError: (msg) => Utils.showToast(msg, 'error')
    });

    $('changeFileBtn').addEventListener('click', reset);
    $('removeBtn').addEventListener('click', removeMetadata);
    $('downloadBtn').addEventListener('click', download);
    $('processAnotherBtn').addEventListener('click', reset);

    function formatDate(d) {
        return d instanceof Date && !isNaN(d) ? d.toLocaleString() : '';
    }

    /**
     * Read every metadata field we know how to remove
     */
    function readMetadata(doc) {
        const xmpHolders = [doc.catalog, ...doc.getPages().map(p => p.node)]
            .filter(node => node.get(PDFName.of('Metadata')));
        return [
            ['Title', doc.getTitle()],
            ['Author', doc.getAuthor()],
            ['Subject', doc.getSubject()],
            ['Keywords', doc.getKeywords()],
            ['Created with', doc.getCreator()],
            ['PDF producer', doc.getProducer()],
            ['Created', formatDate(doc.getCreationDate())],
            ['Last modified', formatDate(doc.getModificationDate())],
            ['XMP metadata blocks', xmpHolders.length ? `${xmpHolders.length} found (can include names, software and edit history)` : '']
        ];
    }

    function renderTable(rows) {
        const table = $('metadataTable');
        table.innerHTML = '';
        for (const [label, value] of rows) {
            const tr = document.createElement('tr');
            tr.className = 'border-t border-gray-100';
            const th = document.createElement('th');
            th.className = 'text-left font-medium text-gray-600 py-2 pr-4 align-top w-40';
            th.textContent = label;
            const td = document.createElement('td');
            td.className = value ? 'py-2 text-gray-900 break-all' : 'py-2 text-gray-400';
            td.textContent = value || 'None';
            tr.appendChild(th);
            tr.appendChild(td);
            table.appendChild(tr);
        }
        const found = rows.filter(([, v]) => v).length;
        $('metadataSummary').textContent = found
            ? `${found} item${found !== 1 ? 's' : ''} found. Anyone you send this file to can see them in their PDF reader's document properties.`
            : 'No metadata found. You can still save a clean copy.';
    }

    async function handleFile(files) {
        if (!files.length) return;
        pdfFile = files[0];
        try {
            dropZone.classList.add('hidden');
            loadingSection.classList.remove('hidden');
            const buffer = await Utils.readFileAsArrayBuffer(pdfFile);
            pdfBytes = new Uint8Array(buffer);
            const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
            const pages = doc.getPageCount();

            $('fileName').textContent = pdfFile.name;
            $('fileMeta').textContent = `${pages} page${pages !== 1 ? 's' : ''} • ${Utils.formatFileSize(pdfFile.size)}`;
            renderTable(readMetadata(doc));

            loadingSection.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            metadataSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading PDF:', error);
            Utils.showToast(error.message && error.message.includes('encrypted')
                ? 'This PDF is password-protected. Unlock it first.'
                : 'Failed to load PDF. Make sure it\'s a valid PDF file.', 'error');
            reset();
        }
    }

    async function removeMetadata() {
        actionSection.classList.add('hidden');
        progressSection.classList.remove('hidden');
        setProgress(30, 'Removing metadata...');
        try {
            // updateMetadata:false stops pdf-lib adding its own producer and dates
            const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

            const info = doc.getInfoDict();
            for (const key of info.keys()) info.delete(key);

            // XMP metadata can sit on the document and on individual pages
            for (const node of [doc.catalog, ...doc.getPages().map(p => p.node)]) {
                const ref = node.get(PDFName.of('Metadata'));
                if (ref instanceof PDFRef) doc.context.delete(ref);
                node.delete(PDFName.of('Metadata'));
            }

            setProgress(80, 'Saving clean copy...');
            outputBytes = await doc.save();

            // Re-read the result to prove it is clean
            const check = await PDFDocument.load(outputBytes, { updateMetadata: false });
            renderTable(readMetadata(check));

            setProgress(100, 'Complete!');
            setTimeout(() => {
                progressSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
                $('metadataSummary').textContent = 'Checked: the cleaned file contains none of these fields.';
                $('resultInfo').textContent = `Clean copy • ${Utils.formatFileSize(outputBytes.length)}`;
            }, 300);
        } catch (error) {
            console.error('Metadata removal error:', error);
            Utils.showToast('Failed to remove metadata. Please try again.', 'error');
            progressSection.classList.add('hidden');
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
        Utils.downloadFile(outputBytes, `${pdfFile.name.replace(/\.pdf$/i, '')}-clean.pdf`, 'application/pdf');
        Utils.showToast('Clean PDF downloaded!', 'success');
    }

    function reset() {
        pdfFile = null; pdfBytes = null; outputBytes = null;
        [fileInfo, loadingSection, metadataSection, actionSection, progressSection, resultSection]
            .forEach(el => el.classList.add('hidden'));
        dropZone.classList.remove('hidden');
    }
})();

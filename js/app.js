/**
 * Private PDF Tools - Shared Utilities
 * Common functions used across all PDF tools
 */

// Utility Functions
const Utils = {
    /**
     * Format file size to human readable string
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Generate a unique ID
     * @returns {string} Unique identifier
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Trigger file download
     * @param {Blob|Uint8Array} data - File data
     * @param {string} filename - Download filename
     * @param {string} mimeType - MIME type of the file
     */
    downloadFile(data, filename, mimeType = 'application/octet-stream') {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Read file as ArrayBuffer
     * @param {File} file - File object
     * @returns {Promise<ArrayBuffer>} File contents as ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Read file as Data URL
     * @param {File} file - File object
     * @returns {Promise<string>} File contents as Data URL
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Create and show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, info)
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// Drag and Drop Manager
class DragDropZone {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            accept: options.accept || '*/*',
            multiple: options.multiple !== false,
            onFiles: options.onFiles || (() => {}),
            onError: options.onError || (() => {})
        };
        this.init();
    }

    init() {
        // Prevent default drag behaviors on window
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.element.addEventListener(event, this.preventDefaults.bind(this), false);
        });

        // Highlight on drag
        ['dragenter', 'dragover'].forEach(event => {
            this.element.addEventListener(event, () => this.element.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(event => {
            this.element.addEventListener(event, () => this.element.classList.remove('drag-over'), false);
        });

        // Handle drop
        this.element.addEventListener('drop', this.handleDrop.bind(this), false);

        // Handle click to browse
        this.element.addEventListener('click', () => this.openFilePicker());
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    openFilePicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.options.accept;
        input.multiple = this.options.multiple;
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            this.processFiles(files);
        };
        input.click();
    }

    processFiles(files) {
        // Filter files by accepted types
        const acceptedTypes = this.options.accept.split(',').map(t => t.trim());
        const validFiles = files.filter(file => {
            if (this.options.accept === '*/*') return true;
            return acceptedTypes.some(type => {
                if (type.startsWith('.')) {
                    return file.name.toLowerCase().endsWith(type.toLowerCase());
                }
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.replace('/*', '/'));
                }
                return file.type === type;
            });
        });

        if (validFiles.length === 0) {
            this.options.onError('No valid files selected');
            return;
        }

        if (!this.options.multiple && validFiles.length > 1) {
            this.options.onFiles([validFiles[0]]);
        } else {
            this.options.onFiles(validFiles);
        }
    }
}

// Sortable List Manager - Uses mouse events for reliable cross-browser drag and drop
class SortableList {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemSelector: options.itemSelector || '.file-item',
            handleSelector: options.handleSelector || '.drag-handle',
            onReorder: options.onReorder || (() => {})
        };
        this.draggedItem = null;
        this.draggedClone = null;
        this.startY = 0;
        this.startX = 0;
        this.offsetY = 0;
        this.offsetX = 0;
        this.init();
    }

    init() {
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);
    }

    handleMouseDown(e) {
        const handle = e.target.closest(this.options.handleSelector);
        if (!handle) return;

        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        e.preventDefault();

        this.draggedItem = item;
        const rect = item.getBoundingClientRect();
        this.offsetY = e.clientY - rect.top;
        this.offsetX = e.clientX - rect.left;
        this.startY = e.clientY;
        this.startX = e.clientX;

        // Create a clone for visual feedback
        this.draggedClone = item.cloneNode(true);
        this.draggedClone.style.position = 'fixed';
        this.draggedClone.style.width = rect.width + 'px';
        this.draggedClone.style.height = rect.height + 'px';
        this.draggedClone.style.left = rect.left + 'px';
        this.draggedClone.style.top = rect.top + 'px';
        this.draggedClone.style.zIndex = '1000';
        this.draggedClone.style.pointerEvents = 'none';
        this.draggedClone.style.opacity = '0.9';
        this.draggedClone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
        this.draggedClone.style.transform = 'scale(1.02)';
        this.draggedClone.style.transition = 'none';
        document.body.appendChild(this.draggedClone);

        // Mark original as dragging
        item.classList.add('dragging');

        // Add move and up listeners to document
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }

    handleMouseMove(e) {
        if (!this.draggedItem || !this.draggedClone) return;

        // Move the clone
        this.draggedClone.style.left = (e.clientX - this.offsetX) + 'px';
        this.draggedClone.style.top = (e.clientY - this.offsetY) + 'px';

        // Find the item we're hovering over
        const items = Array.from(this.container.querySelectorAll(this.options.itemSelector));

        // Clear all drag-over states
        items.forEach(item => {
            item.classList.remove('drag-over');
            item.style.borderTopWidth = '';
            item.style.borderBottomWidth = '';
        });

        // Find target item
        for (const item of items) {
            if (item === this.draggedItem) continue;

            const rect = item.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                item.classList.add('drag-over');

                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    item.style.borderTopWidth = '3px';
                } else {
                    item.style.borderBottomWidth = '3px';
                }
                break;
            }
        }
    }

    handleMouseUp(e) {
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);

        if (!this.draggedItem) return;

        // Remove the clone
        if (this.draggedClone && this.draggedClone.parentNode) {
            this.draggedClone.parentNode.removeChild(this.draggedClone);
        }

        // Find target and reorder
        const items = Array.from(this.container.querySelectorAll(this.options.itemSelector));
        let targetItem = null;
        let insertBefore = true;

        for (const item of items) {
            if (item === this.draggedItem) continue;

            const rect = item.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                targetItem = item;
                insertBefore = e.clientY < (rect.top + rect.height / 2);
                break;
            }
        }

        // Clear styles
        items.forEach(item => {
            item.classList.remove('dragging', 'drag-over');
            item.style.borderTopWidth = '';
            item.style.borderBottomWidth = '';
        });

        // Perform the reorder
        if (targetItem && targetItem !== this.draggedItem) {
            if (insertBefore) {
                targetItem.parentNode.insertBefore(this.draggedItem, targetItem);
            } else {
                targetItem.parentNode.insertBefore(this.draggedItem, targetItem.nextSibling);
            }

            // Notify of new order
            const newItems = Array.from(this.container.querySelectorAll(this.options.itemSelector));
            const newOrder = newItems.map(el => el.dataset.id);
            this.options.onReorder(newOrder);
        }

        this.draggedItem = null;
        this.draggedClone = null;
    }
}

// Progress Tracker
class ProgressTracker {
    constructor(element) {
        this.element = element;
        this.progressBar = element.querySelector('.progress');
        this.progressText = element.querySelector('.progress-text');
    }

    update(percent, text = '') {
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }
        if (this.progressText && text) {
            this.progressText.textContent = text;
        }
    }

    show() {
        this.element.classList.remove('hidden');
    }

    hide() {
        this.element.classList.add('hidden');
    }

    reset() {
        this.update(0, '');
    }
}

// Export utilities for use in other modules
window.PDFTools = {
    Utils,
    DragDropZone,
    SortableList,
    ProgressTracker
};

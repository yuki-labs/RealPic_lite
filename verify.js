/**
 * Verify Page JavaScript
 * Handles watermark verification with auto-upload for shareable links
 */

(function () {
    'use strict';

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const previewArea = document.getElementById('previewArea');
    const imagePreview = document.getElementById('imagePreview');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultSubtitle = document.getElementById('resultSubtitle');
    const confidenceFill = document.getElementById('confidenceFill');
    const resultDetails = document.getElementById('resultDetails');
    const watermarkType = document.getElementById('watermarkType');
    const confidenceValue = document.getElementById('confidenceValue');
    const embeddedMessage = document.getElementById('embeddedMessage');
    const verifyAnotherBtn = document.getElementById('verifyAnotherBtn');
    const shareSection = document.getElementById('shareSection');
    const shareResult = document.getElementById('shareResult');
    const shareUrl = document.getElementById('shareUrl');
    const copyShareUrl = document.getElementById('copyShareUrl');
    const shareNote = document.getElementById('shareNote');

    // Track current state
    let currentBlobUrl = null;

    // Initialize event listeners
    function init() {
        // Drop zone click (but not on paste button)
        dropZone.addEventListener('click', (e) => {
            if (e.target.closest('.paste-btn')) return;
            fileInput.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                processImage(file);
            }
        });

        // Keyboard paste (Ctrl+V)
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        processImage(file);
                    }
                    break;
                }
            }
        });

        // Paste button for mobile
        pasteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    if (imageType) {
                        const blob = await item.getType(imageType);
                        processImage(blob);
                        return;
                    }
                }
                alert('No image found in clipboard. Copy an image first, then try again.');
            } catch (err) {
                console.error('Clipboard read failed:', err);
                alert('Could not access clipboard. Please use drag and drop instead.');
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                processImage(file);
            }
        });

        // Verify another button
        verifyAnotherBtn.addEventListener('click', () => {
            previewArea.classList.remove('active');
            dropZone.style.display = 'block';
            fileInput.value = '';
            shareResult.classList.add('hidden');
            shareNote.textContent = '';
            if (shareSection) shareSection.style.display = 'none';
        });

        // Copy share URL button
        copyShareUrl.addEventListener('click', () => {
            shareUrl.select();
            navigator.clipboard.writeText(shareUrl.value).then(() => {
                shareNote.textContent = 'Link copied to clipboard!';
                shareNote.className = 'share-note success';
            }).catch(() => {
                document.execCommand('copy');
                shareNote.textContent = 'Link copied!';
                shareNote.className = 'share-note success';
            });
        });
    }

    // Process uploaded/pasted image - uploads immediately for shareable URL
    async function processImage(file) {
        dropZone.style.display = 'none';
        loadingSpinner.classList.add('active');
        previewArea.classList.remove('active');
        if (shareSection) shareSection.style.display = 'none';

        // Clean up previous blob URL
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }

        try {
            // Upload image to server first (for shareable URL)
            const formData = new FormData();
            formData.append('image', file);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadResponse.json();

            if (!uploadData.success) {
                throw new Error(uploadData.error || 'Upload failed');
            }

            // Use the uploaded URL for the preview (so context menu gives shareable link)
            const shareableUrl = uploadData.data.fullUrl;
            const localUrl = uploadData.data.url;

            // Load image from server URL
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                // Set preview to the shareable URL (context menu will copy this)
                imagePreview.src = shareableUrl;

                // Create canvas for watermark verification
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Show share section with the URL
                if (shareSection) shareSection.style.display = 'block';
                shareUrl.value = shareableUrl;
                shareResult.classList.remove('hidden');
                shareNote.textContent = 'Right-click the image → Copy Image Address to share';
                shareNote.className = 'share-note success';

                // Verify watermarks
                verifyWatermarks(imageData);
            };

            img.onerror = () => {
                // Fallback to blob URL if server URL fails to load
                currentBlobUrl = URL.createObjectURL(file);
                loadImageFromBlob(file, currentBlobUrl);
            };

            img.src = localUrl;

        } catch (err) {
            console.error('Upload failed, using local preview:', err);
            // Fallback to blob URL
            currentBlobUrl = URL.createObjectURL(file);
            loadImageFromBlob(file, currentBlobUrl);
        }
    }

    // Fallback: load image from blob URL
    function loadImageFromBlob(file, blobUrl) {
        const img = new Image();
        img.onload = () => {
            imagePreview.src = blobUrl;

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Hide share section on fallback
            if (shareSection) shareSection.style.display = 'block';
            shareNote.textContent = 'Upload failed - image not shareable';
            shareNote.className = 'share-note error';
            shareResult.classList.add('hidden');

            verifyWatermarks(imageData);
        };
        img.src = blobUrl;
    }

    // Verify watermarks in image
    function verifyWatermarks(imageData) {
        loadingSpinner.classList.remove('active');
        previewArea.classList.add('active');
        resultDetails.style.display = 'block';

        let robustResult = null;
        let lsbResult = null;

        try {
            if (typeof RobustWatermark !== 'undefined') {
                robustResult = RobustWatermark.decode(imageData);
            }
        } catch (e) {
            console.warn('Robust decode error:', e);
        }

        try {
            lsbResult = Steganography.decode(imageData);
        } catch (e) {
            console.warn('LSB decode error:', e);
        }

        if (robustResult && robustResult.found && robustResult.confidence > 0.6) {
            showResult('success',
                'Authentic RealPic Watermark',
                'This image contains a robust, tamper-resistant watermark',
                robustResult.confidence,
                'DCT-Domain (Robust)',
                robustResult.message || 'Unable to decode message'
            );
        } else if (lsbResult) {
            showResult('warning',
                'Legacy Watermark Detected',
                'This image has an older LSB watermark (may have been modified)',
                0.5,
                'LSB Steganography (Legacy)',
                lsbResult
            );
        } else if (robustResult && robustResult.confidence > 0.3) {
            showResult('warning',
                'Possible Watermark Detected',
                'The image may have been modified or compressed',
                robustResult.confidence,
                'Partially Recovered',
                robustResult.message || 'Watermark damaged'
            );
        } else {
            showResult('error',
                'No Watermark Found',
                'This image does not contain a valid RealPic watermark',
                0,
                'None',
                'N/A'
            );
        }
    }

    // Display verification result
    function showResult(type, title, subtitle, confidence, wmType, message) {
        resultIcon.className = `result-icon ${type}`;

        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`
        };

        resultIcon.innerHTML = icons[type] || icons.error;
        resultTitle.textContent = title;
        resultSubtitle.textContent = subtitle;

        const percent = Math.round(confidence * 100);
        confidenceFill.style.width = `${percent}%`;
        confidenceFill.className = `confidence-fill ${confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low'}`;

        watermarkType.textContent = wmType;
        confidenceValue.textContent = `${percent}%`;
        embeddedMessage.textContent = message || 'N/A';
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

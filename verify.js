/**
 * Verify Page JavaScript
 * Handles watermark verification functionality
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

        // Paste button for mobile (uses Clipboard API)
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
        });
    }

    // Track current blob URL for cleanup
    let currentBlobUrl = null;

    // Process uploaded/pasted image
    function processImage(file) {
        dropZone.style.display = 'none';
        loadingSpinner.classList.add('active');
        previewArea.classList.remove('active');

        // Clean up previous blob URL
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
        }

        // Create blob URL (short URL, won't crash Firefox on share/copy)
        currentBlobUrl = URL.createObjectURL(file);

        const img = new Image();
        img.onload = () => {
            imagePreview.src = currentBlobUrl;

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            setTimeout(() => {
                verifyWatermarks(imageData);
            }, 500);
        };
        img.src = currentBlobUrl;
    }

    // Verify watermarks in image
    function verifyWatermarks(imageData) {
        loadingSpinner.classList.remove('active');
        previewArea.classList.add('active');
        resultDetails.style.display = 'block';

        let robustResult = null;
        let lsbResult = null;

        // Try robust watermark first
        try {
            if (typeof RobustWatermark !== 'undefined') {
                robustResult = RobustWatermark.decode(imageData);
            }
        } catch (e) {
            console.warn('Robust decode error:', e);
        }

        // Try LSB steganography
        try {
            lsbResult = Steganography.decode(imageData);
        } catch (e) {
            console.warn('LSB decode error:', e);
        }

        // Determine result
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

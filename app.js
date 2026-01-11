/**
 * RealPic Lite - Main Application
 * Camera capture with visible and invisible watermarks.
 */

const App = (() => {
    // State
    let currentStream = null;
    let facingMode = 'environment';

    // Camera device tracking
    let videoDevices = [];
    let currentDeviceIndex = 0;
    let hasMultipleCameras = false;

    // User-configurable settings
    const settings = {
        visibleText: 'RealPic',
        position: 'bottom-right',
        opacity: 70,
        size: 24,
        showDateTime: true,
        customText: '',
        includeTimestamp: true,
        includeUserAgent: true
    };

    // DOM Elements
    const elements = {};

    function init() {
        cacheElements();
        loadSettings();
        bindEvents();
        initCamera();
    }

    function cacheElements() {
        elements.cameraFeed = document.getElementById('cameraFeed');
        elements.captureCanvas = document.getElementById('captureCanvas');
        elements.previewCanvas = document.getElementById('previewCanvas');
        elements.cameraStatus = document.getElementById('cameraStatus');
        elements.cameraSection = document.getElementById('cameraSection');
        elements.previewSection = document.getElementById('previewSection');
        elements.captureBtn = document.getElementById('captureBtn');
        elements.switchCameraBtn = document.getElementById('switchCameraBtn');
        elements.settingsBtn = document.getElementById('settingsBtn');
        elements.discardBtn = document.getElementById('discardBtn');
        elements.copyBtn = document.getElementById('copyBtn');
        elements.saveBtn = document.getElementById('saveBtn');
        elements.settingsModal = document.getElementById('settingsModal');
        elements.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        elements.showDateTime = document.getElementById('showDateTime');
        elements.customText = document.getElementById('customText');
        elements.toastContainer = document.getElementById('toastContainer');
        elements.cameraContainer = document.querySelector('.camera-container');
        elements.previewContainer = document.querySelector('.preview-container');
    }

    function bindEvents() {
        elements.captureBtn.addEventListener('click', capturePhoto);
        elements.switchCameraBtn.addEventListener('click', switchCamera);
        elements.settingsBtn.addEventListener('click', openSettings);
        elements.discardBtn.addEventListener('click', discardPhoto);
        elements.copyBtn.addEventListener('click', copyPhoto);
        elements.saveBtn.addEventListener('click', downloadPhoto);
        elements.closeSettingsBtn.addEventListener('click', closeSettings);
        elements.saveSettingsBtn.addEventListener('click', saveSettings);

        // Close modal on overlay click
        elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) closeSettings();
        });

        // Window resize - update container size
        window.addEventListener('resize', updateContainerSize);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSettings();
            }
            if (e.code === 'Space' && !elements.cameraSection.classList.contains('hidden')) {
                e.preventDefault();
                capturePhoto();
            }
        });
    }

    // Settings Functions
    function loadSettings() {
        try {
            const stored = localStorage.getItem('realpic_settings');
            if (stored) {
                const loaded = JSON.parse(stored);
                Object.assign(settings, loaded);
            }
        } catch (e) {
            console.warn('Could not load settings:', e);
        }
        applySettingsToUI();
    }

    function applySettingsToUI() {
        if (elements.showDateTime) {
            elements.showDateTime.checked = settings.showDateTime;
        }
        if (elements.customText) {
            elements.customText.value = settings.customText || '';
        }
    }

    function openSettings() {
        applySettingsToUI();
        elements.settingsModal.classList.remove('hidden');
    }

    function closeSettings() {
        elements.settingsModal.classList.add('hidden');
    }

    function saveSettings() {
        settings.showDateTime = elements.showDateTime.checked;
        settings.customText = elements.customText.value;

        try {
            localStorage.setItem('realpic_settings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Could not save settings:', e);
        }

        closeSettings();
        showToast('Settings saved', 'success');
    }

    // Camera Functions
    async function initCamera() {
        try {
            updateCameraStatus('Initializing camera...');

            let constraints;

            if (videoDevices.length > 0 && videoDevices[currentDeviceIndex]) {
                constraints = {
                    video: {
                        deviceId: { exact: videoDevices[currentDeviceIndex].deviceId },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };
            } else {
                constraints = {
                    video: {
                        facingMode: facingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };
            }

            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            elements.cameraFeed.srcObject = currentStream;
            elements.cameraFeed.setAttribute('data-active', 'true');

            await elements.cameraFeed.play();

            if (videoDevices.length === 0) {
                await enumerateVideoDevices();
            }

            updateCameraStatus('Ready', true);
            updateContainerSize();
            setTimeout(() => {
                elements.cameraStatus.classList.add('hidden');
            }, 2000);

        } catch (error) {
            console.error('Camera error:', error);
            updateCameraStatus('Camera access denied');
            showToast('Could not access camera. Please check permissions.', 'error');
        }
    }

    async function enumerateVideoDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            videoDevices = devices.filter(device => device.kind === 'videoinput');
            hasMultipleCameras = videoDevices.length > 1;

            if (currentStream) {
                const currentTrack = currentStream.getVideoTracks()[0];
                if (currentTrack) {
                    const currentSettings = currentTrack.getSettings();
                    const currentDeviceId = currentSettings.deviceId;

                    const foundIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
                    if (foundIndex !== -1) {
                        currentDeviceIndex = foundIndex;
                    }
                }
            }

            if (!hasMultipleCameras && elements.switchCameraBtn) {
                elements.switchCameraBtn.style.visibility = 'hidden';
            }

            console.log(`Found ${videoDevices.length} camera(s)`);
        } catch (error) {
            console.warn('Could not enumerate devices:', error);
        }
    }

    function updateCameraStatus(message, ready = false) {
        elements.cameraStatus.classList.remove('hidden', 'ready');
        if (ready) elements.cameraStatus.classList.add('ready');
        elements.cameraStatus.querySelector('span').textContent = message;
    }

    // Update container size to match video aspect ratio
    function updateContainerSize() {
        const video = elements.cameraFeed;
        const container = elements.cameraContainer;

        if (!video || !container) return;

        // Wait for video to have dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            setTimeout(updateContainerSize, 100);
            return;
        }

        const videoAspect = video.videoWidth / video.videoHeight;

        // Set the container's aspect ratio to match the video
        container.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        container.style.flex = 'none';
        container.style.width = '100%';
        container.style.maxHeight = 'calc(100vh - 200px)';

        // If container is taller than viewport allows, constrain by height
        const section = elements.cameraSection;
        if (section) {
            const availableHeight = section.clientHeight - 150; // Leave room for controls
            const containerWidth = container.clientWidth;
            const idealHeight = containerWidth / videoAspect;

            if (idealHeight > availableHeight) {
                container.style.width = `${availableHeight * videoAspect}px`;
                container.style.alignSelf = 'center';
            }
        }
    }

    async function switchCamera() {
        if (!hasMultipleCameras || videoDevices.length < 2) {
            showToast('No other camera available', 'error');
            return;
        }

        updateCameraStatus('Switching camera...');

        currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
        const newDeviceId = videoDevices[currentDeviceIndex].deviceId;

        const oldStream = currentStream;

        try {
            const constraints = {
                video: {
                    deviceId: { exact: newDeviceId },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);

            currentStream = newStream;
            elements.cameraFeed.srcObject = newStream;

            await elements.cameraFeed.play();

            if (oldStream) {
                oldStream.getTracks().forEach(track => track.stop());
            }

            updateCameraStatus('Ready', true);
            updateContainerSize();
            setTimeout(() => {
                elements.cameraStatus.classList.add('hidden');
            }, 1000);

        } catch (error) {
            console.error('Error switching camera:', error);
            showToast('Could not switch camera', 'error');

            if (oldStream && !currentStream) {
                currentStream = oldStream;
                elements.cameraFeed.srcObject = oldStream;
            }

            currentDeviceIndex = (currentDeviceIndex - 1 + videoDevices.length) % videoDevices.length;
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        elements.cameraFeed.srcObject = null;
    }

    // Capture Functions
    function capturePhoto() {
        const video = elements.cameraFeed;
        const canvas = elements.captureCanvas;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Flash effect
        elements.cameraFeed.classList.add('capture-flash');
        setTimeout(() => {
            elements.cameraFeed.classList.remove('capture-flash');
        }, 200);

        applyWatermarks();
    }

    function applyWatermarks() {
        const sourceCanvas = elements.captureCanvas;
        const previewCanvas = elements.previewCanvas;

        previewCanvas.width = sourceCanvas.width;
        previewCanvas.height = sourceCanvas.height;

        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0);

        // Apply visible watermark with all settings
        Watermark.applyVisible(ctx, previewCanvas.width, previewCanvas.height, {
            text: settings.visibleText,
            position: settings.position,
            opacity: settings.opacity,
            size: settings.size,
            showDateTime: settings.showDateTime,
            customText: settings.customText
        });

        // Apply invisible watermark (steganography)
        const invisibleData = buildInvisibleData();
        if (invisibleData) {
            const imageData = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
            try {
                const encodedData = Steganography.encode(imageData, invisibleData);
                ctx.putImageData(encodedData, 0, 0);
            } catch (error) {
                console.warn('Steganography encoding failed:', error);
            }
        }

        showPreview();
    }

    function buildInvisibleData() {
        const parts = [];

        if (settings.includeTimestamp) {
            parts.push(`Time: ${new Date().toISOString()}`);
        }

        if (settings.customText) {
            parts.push(`Custom: ${settings.customText}`);
        }

        if (settings.includeUserAgent) {
            parts.push(`UA: ${navigator.userAgent}`);
        }

        return parts.length > 0 ? parts.join(' | ') : null;
    }

    // View Functions
    function showPreview() {
        elements.cameraSection.classList.add('hidden');
        elements.previewSection.classList.remove('hidden');
        stopCamera();
        updatePreviewContainerSize();
    }

    // Update preview container size to match canvas dimensions
    function updatePreviewContainerSize() {
        const canvas = elements.previewCanvas;
        const container = elements.previewContainer;

        if (!canvas || !container) return;

        if (canvas.width === 0 || canvas.height === 0) return;

        // Set the container's aspect ratio to match the canvas
        container.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
        container.style.flex = 'none';
        container.style.width = '100%';
        container.style.maxHeight = 'calc(100vh - 200px)';

        // If container is taller than viewport allows, constrain by height
        const section = elements.previewSection;
        if (section) {
            const canvasAspect = canvas.width / canvas.height;
            const availableHeight = section.clientHeight - 150;
            const containerWidth = container.clientWidth;
            const idealHeight = containerWidth / canvasAspect;

            if (idealHeight > availableHeight) {
                container.style.width = `${availableHeight * canvasAspect}px`;
                container.style.alignSelf = 'center';
            }
        }
    }

    function showCamera() {
        elements.previewSection.classList.add('hidden');
        elements.cameraSection.classList.remove('hidden');
        initCamera();
    }

    function discardPhoto() {
        showCamera();
    }

    // Download Function
    function downloadPhoto() {
        const dataUrl = elements.previewCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `realpic_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        showToast('Photo downloaded!', 'success');
        showCamera();
    }

    // Copy to Clipboard Function (with Share fallback for mobile)
    async function copyPhoto() {
        const canvas = elements.previewCanvas;

        // Convert canvas to blob
        let blob;
        try {
            blob = await new Promise((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('Failed to create blob'));
                }, 'image/png');
            });
        } catch (error) {
            console.error('Blob creation failed:', error);
            showToast('Could not process image.', 'error');
            return;
        }

        // Try Clipboard API first (works on desktop browsers)
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showToast('Image copied to clipboard!', 'success');
                return;
            } catch (clipboardError) {
                console.log('Clipboard API failed, trying Web Share API...', clipboardError);
            }
        }

        // Fallback: Try Web Share API (works on mobile)
        if (navigator.share && navigator.canShare) {
            try {
                const file = new File([blob], `realpic_${Date.now()}.png`, { type: 'image/png' });
                const shareData = { files: [file] };

                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    showToast('Image shared!', 'success');
                    return;
                }
            } catch (shareError) {
                // User cancelled share or share failed
                if (shareError.name !== 'AbortError') {
                    console.log('Web Share API failed:', shareError);
                }
                return;
            }
        }

        // Neither worked
        showToast('Copy not supported. Use Download instead.', 'error');
    }

    // Toast Notifications
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = type === 'success'
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>${message}</span>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${message}</span>`;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.25s ease forwards';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }

    return { init };
})();

// Initialize app
document.addEventListener('DOMContentLoaded', App.init);

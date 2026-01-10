/**
 * RealPic Lite - Main Application
 * Camera capture with visible and invisible watermarks.
 */

const App = (() => {
    // State
    let currentStream = null;
    let facingMode = 'environment';
    let photos = [];
    let currentPhotoIndex = -1;
    let userLocation = null;

    // Camera device tracking
    let videoDevices = [];
    let currentDeviceIndex = 0;
    let hasMultipleCameras = false;

    // Settings
    let settings = {
        visibleText: '© RealPic Lite',
        position: 'bottom-right',
        opacity: 70,
        size: 24,
        invisibleText: '',
        includeTimestamp: true,
        includeLocation: false,
        includeDeviceInfo: true
    };

    // DOM Elements
    const elements = {};

    function init() {
        cacheElements();
        loadSettings();
        loadPhotos();
        bindEvents();
        initCamera();

        if (settings.includeLocation) {
            requestLocation();
        }
    }

    function cacheElements() {
        elements.cameraFeed = document.getElementById('cameraFeed');
        elements.captureCanvas = document.getElementById('captureCanvas');
        elements.previewCanvas = document.getElementById('previewCanvas');
        elements.cameraStatus = document.getElementById('cameraStatus');
        elements.cameraSection = document.getElementById('cameraSection');
        elements.previewSection = document.getElementById('previewSection');
        elements.gallerySection = document.getElementById('gallerySection');
        elements.captureBtn = document.getElementById('captureBtn');
        elements.switchCameraBtn = document.getElementById('switchCameraBtn');
        elements.galleryBtn = document.getElementById('galleryBtn');
        elements.discardBtn = document.getElementById('discardBtn');
        elements.saveBtn = document.getElementById('saveBtn');
        elements.galleryBackBtn = document.getElementById('galleryBackBtn');
        elements.galleryGrid = document.getElementById('galleryGrid');
        elements.galleryEmpty = document.getElementById('galleryEmpty');
        elements.photoCount = document.getElementById('photoCount');
        elements.settingsBtn = document.getElementById('settingsBtn');
        elements.settingsModal = document.getElementById('settingsModal');
        elements.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        elements.resetSettingsBtn = document.getElementById('resetSettingsBtn');
        elements.photoModal = document.getElementById('photoModal');
        elements.closePhotoBtn = document.getElementById('closePhotoBtn');
        elements.modalPhoto = document.getElementById('modalPhoto');
        elements.modalTimestamp = document.getElementById('modalTimestamp');
        elements.modalHiddenData = document.getElementById('modalHiddenData');
        elements.deletePhotoBtn = document.getElementById('deletePhotoBtn');
        elements.downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
        elements.toastContainer = document.getElementById('toastContainer');

        // Settings inputs
        elements.visibleWatermarkText = document.getElementById('visibleWatermarkText');
        elements.watermarkPosition = document.getElementById('watermarkPosition');
        elements.watermarkOpacity = document.getElementById('watermarkOpacity');
        elements.watermarkSize = document.getElementById('watermarkSize');
        elements.opacityValue = document.getElementById('opacityValue');
        elements.sizeValue = document.getElementById('sizeValue');
        elements.invisibleWatermarkText = document.getElementById('invisibleWatermarkText');
        elements.includeTimestamp = document.getElementById('includeTimestamp');
        elements.includeLocation = document.getElementById('includeLocation');
        elements.includeDeviceInfo = document.getElementById('includeDeviceInfo');
        elements.extractDataBtn = document.getElementById('extractDataBtn');

        // Upload elements
        elements.uploadBtn = document.getElementById('uploadBtn');
        elements.uploadEmptyBtn = document.getElementById('uploadEmptyBtn');
        elements.photoUploadInput = document.getElementById('photoUploadInput');
        elements.uploadedBadgeContainer = document.getElementById('uploadedBadgeContainer');
    }

    function bindEvents() {
        elements.captureBtn.addEventListener('click', capturePhoto);
        elements.switchCameraBtn.addEventListener('click', switchCamera);
        elements.galleryBtn.addEventListener('click', showGallery);
        elements.discardBtn.addEventListener('click', discardPhoto);
        elements.saveBtn.addEventListener('click', savePhoto);
        elements.galleryBackBtn.addEventListener('click', showCamera);
        elements.settingsBtn.addEventListener('click', openSettings);
        elements.closeSettingsBtn.addEventListener('click', closeSettings);
        elements.saveSettingsBtn.addEventListener('click', saveSettings);
        elements.resetSettingsBtn.addEventListener('click', resetSettings);
        elements.closePhotoBtn.addEventListener('click', closePhotoModal);
        elements.deletePhotoBtn.addEventListener('click', deletePhoto);
        elements.downloadPhotoBtn.addEventListener('click', downloadPhoto);
        elements.extractDataBtn.addEventListener('click', extractHiddenData);

        // Upload buttons
        elements.uploadBtn.addEventListener('click', () => elements.photoUploadInput.click());
        elements.uploadEmptyBtn.addEventListener('click', () => elements.photoUploadInput.click());
        elements.photoUploadInput.addEventListener('change', handlePhotoUpload);

        // Range sliders
        elements.watermarkOpacity.addEventListener('input', (e) => {
            elements.opacityValue.textContent = e.target.value + '%';
        });
        elements.watermarkSize.addEventListener('input', (e) => {
            elements.sizeValue.textContent = e.target.value + 'px';
        });

        // Close modals on overlay click
        elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) closeSettings();
        });
        elements.photoModal.addEventListener('click', (e) => {
            if (e.target === elements.photoModal) closePhotoModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSettings();
                closePhotoModal();
            }
            if (e.code === 'Space' && !elements.cameraSection.classList.contains('hidden')) {
                e.preventDefault();
                capturePhoto();
            }
        });
    }

    // Camera Functions
    async function initCamera() {
        try {
            updateCameraStatus('Initializing camera...');

            // Build constraints - prefer deviceId if we have enumerated devices
            let constraints;

            if (videoDevices.length > 0 && videoDevices[currentDeviceIndex]) {
                // Use specific device ID (doesn't trigger new permission prompt)
                constraints = {
                    video: {
                        deviceId: { exact: videoDevices[currentDeviceIndex].deviceId },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };
            } else {
                // First time - use facingMode
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

            // Enumerate devices after we have permission (required for full device info)
            if (videoDevices.length === 0) {
                await enumerateVideoDevices();
            }

            updateCameraStatus('Ready', true);
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

            // Find which device we're currently using and set the index
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

            // Hide switch button if only one camera
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

    async function switchCamera() {
        if (!hasMultipleCameras || videoDevices.length < 2) {
            showToast('No other camera available', 'error');
            return;
        }

        updateCameraStatus('Switching camera...');

        // Cycle to next camera
        currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
        const newDeviceId = videoDevices[currentDeviceIndex].deviceId;

        // Keep reference to old stream - DO NOT stop it yet
        // Firefox mobile requires an active stream to avoid re-prompting for permission
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

            // Get new stream WHILE old stream is still active
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Now we have the new stream, assign it to video element
            currentStream = newStream;
            elements.cameraFeed.srcObject = newStream;

            await elements.cameraFeed.play();

            // NOW stop the old stream (after new one is working)
            if (oldStream) {
                oldStream.getTracks().forEach(track => track.stop());
            }

            updateCameraStatus('Ready', true);
            setTimeout(() => {
                elements.cameraStatus.classList.add('hidden');
            }, 1000);

        } catch (error) {
            console.error('Error switching camera:', error);
            showToast('Could not switch camera', 'error');

            // Restore the old stream if switch failed
            if (oldStream && !currentStream) {
                currentStream = oldStream;
                elements.cameraFeed.srcObject = oldStream;
            }

            // Revert to previous camera index
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

        // Apply watermarks and show preview
        applyWatermarks();
    }

    function applyWatermarks() {
        const sourceCanvas = elements.captureCanvas;
        const previewCanvas = elements.previewCanvas;

        previewCanvas.width = sourceCanvas.width;
        previewCanvas.height = sourceCanvas.height;

        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0);

        // Build visible data text for display below main watermark
        const visibleDataText = buildVisibleDataText();

        // Apply visible watermark with data text
        Watermark.applyVisible(ctx, previewCanvas.width, previewCanvas.height, {
            text: settings.visibleText,
            position: settings.position,
            opacity: settings.opacity,
            size: settings.size,
            dataText: visibleDataText
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

    /**
     * Builds visible data text for display below watermark
     */
    function buildVisibleDataText() {
        const parts = [];

        if (settings.includeTimestamp) {
            const now = new Date();
            const dateStr = now.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const timeStr = now.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            });
            parts.push(`${dateStr} ${timeStr}`);
        }

        if (settings.includeLocation && userLocation) {
            parts.push(`📍 ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`);
        }

        if (settings.includeDeviceInfo) {
            const deviceInfo = getDeviceInfo();
            // Create a compact visible version
            const visibleParts = [];
            if (deviceInfo.browser) visibleParts.push(deviceInfo.browser);
            if (deviceInfo.os) visibleParts.push(deviceInfo.os);
            if (deviceInfo.platform) visibleParts.push(deviceInfo.platform);
            parts.push(visibleParts.join(' • '));
        }

        return parts.length > 0 ? parts.join(' | ') : null;
    }

    /**
     * Gathers device and browser information
     */
    function getDeviceInfo() {
        const ua = navigator.userAgent;
        const info = {
            browser: 'Unknown',
            browserVersion: '',
            os: 'Unknown',
            osVersion: '',
            platform: 'Unknown',
            screenRes: `${window.screen.width}x${window.screen.height}`,
            devicePixelRatio: window.devicePixelRatio || 1,
            language: navigator.language || 'Unknown',
            camera: 'Unknown'
        };

        // Detect browser
        if (ua.includes('Firefox/')) {
            info.browser = 'Firefox';
            info.browserVersion = ua.match(/Firefox\/(\d+\.?\d*)/)?.[1] || '';
        } else if (ua.includes('Edg/')) {
            info.browser = 'Edge';
            info.browserVersion = ua.match(/Edg\/(\d+\.?\d*)/)?.[1] || '';
        } else if (ua.includes('Chrome/')) {
            info.browser = 'Chrome';
            info.browserVersion = ua.match(/Chrome\/(\d+\.?\d*)/)?.[1] || '';
        } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
            info.browser = 'Safari';
            info.browserVersion = ua.match(/Version\/(\d+\.?\d*)/)?.[1] || '';
        } else if (ua.includes('Opera') || ua.includes('OPR/')) {
            info.browser = 'Opera';
            info.browserVersion = ua.match(/(?:Opera|OPR)\/(\d+\.?\d*)/)?.[1] || '';
        }

        // Detect OS
        if (ua.includes('Windows NT')) {
            info.os = 'Windows';
            const winVersion = ua.match(/Windows NT (\d+\.\d+)/);
            if (winVersion) {
                const versionMap = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
                info.osVersion = versionMap[winVersion[1]] || winVersion[1];
            }
        } else if (ua.includes('Mac OS X')) {
            info.os = 'macOS';
            info.osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
        } else if (ua.includes('Android')) {
            info.os = 'Android';
            info.osVersion = ua.match(/Android (\d+\.?\d*)/)?.[1] || '';
        } else if (ua.includes('iPhone') || ua.includes('iPad')) {
            info.os = ua.includes('iPad') ? 'iPadOS' : 'iOS';
            info.osVersion = ua.match(/OS (\d+[_.]\d+)/)?.[1]?.replace('_', '.') || '';
        } else if (ua.includes('Linux')) {
            info.os = 'Linux';
        } else if (ua.includes('CrOS')) {
            info.os = 'ChromeOS';
        }

        // Detect platform type
        if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
            info.platform = ua.includes('iPad') || (ua.includes('Android') && !ua.includes('Mobile')) ? 'Tablet' : 'Mobile';
        } else {
            info.platform = 'Desktop';
        }

        // Get camera info if available
        if (videoDevices.length > 0 && videoDevices[currentDeviceIndex]) {
            const device = videoDevices[currentDeviceIndex];
            info.camera = device.label || `Camera ${currentDeviceIndex + 1}`;
        }

        return info;
    }

    /**
     * Formats device info into a compact string for watermark
     */
    function formatDeviceInfo(info) {
        const parts = [];
        parts.push(`${info.browser}${info.browserVersion ? '/' + info.browserVersion : ''}`);
        parts.push(`${info.os}${info.osVersion ? ' ' + info.osVersion : ''}`);
        parts.push(info.platform);
        parts.push(`${info.screenRes}@${info.devicePixelRatio}x`);
        if (info.camera !== 'Unknown') {
            parts.push(`Cam: ${info.camera}`);
        }
        return parts.join(', ');
    }

    function buildInvisibleData() {
        const parts = [];

        if (settings.invisibleText) {
            parts.push(settings.invisibleText);
        }

        if (settings.includeTimestamp) {
            parts.push(`Time: ${new Date().toISOString()}`);
        }

        if (settings.includeLocation && userLocation) {
            parts.push(`Loc: ${userLocation.lat.toFixed(6)},${userLocation.lng.toFixed(6)}`);
        }

        if (settings.includeDeviceInfo) {
            const deviceInfo = getDeviceInfo();
            parts.push(`Device: ${formatDeviceInfo(deviceInfo)}`);
        }

        return parts.length > 0 ? parts.join(' | ') : null;
    }

    // View Functions
    function showPreview() {
        elements.cameraSection.classList.add('hidden');
        elements.previewSection.classList.remove('hidden');
        stopCamera();
    }

    function showCamera() {
        elements.previewSection.classList.add('hidden');
        elements.gallerySection.classList.add('hidden');
        elements.cameraSection.classList.remove('hidden');
        initCamera();
    }

    function showGallery() {
        elements.cameraSection.classList.add('hidden');
        elements.previewSection.classList.add('hidden');
        elements.gallerySection.classList.remove('hidden');
        stopCamera();
        renderGallery();
    }

    function discardPhoto() {
        showCamera();
    }

    // Save/Load Functions
    function savePhoto() {
        const dataUrl = elements.previewCanvas.toDataURL('image/png');
        const photo = {
            id: Date.now(),
            data: dataUrl,
            timestamp: new Date().toISOString(),
            hiddenData: buildInvisibleData() || 'None'
        };

        photos.unshift(photo);
        savePhotos();
        showToast('Photo saved!', 'success');
        showCamera();
    }

    function savePhotos() {
        try {
            localStorage.setItem('realpic_photos', JSON.stringify(photos));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                photos = photos.slice(0, -1);
                showToast('Storage full. Oldest photo removed.', 'error');
                savePhotos();
            }
        }
    }

    /**
     * Handles photo upload from file input
     */
    function handlePhotoUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        let uploadCount = 0;
        const totalFiles = files.length;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                showToast(`${file.name} is not an image`, 'error');
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const dataUrl = e.target.result;

                // Create photo object marked as uploaded
                const photo = {
                    id: Date.now() + Math.random(), // Ensure unique IDs for multiple uploads
                    data: dataUrl,
                    timestamp: new Date().toISOString(),
                    hiddenData: 'Unknown (uploaded)',
                    uploaded: true,
                    originalName: file.name
                };

                photos.unshift(photo);
                uploadCount++;

                // When all files are processed
                if (uploadCount === totalFiles) {
                    savePhotos();
                    renderGallery();
                    showToast(`${uploadCount} photo${uploadCount > 1 ? 's' : ''} uploaded for verification`, 'success');
                }
            };

            reader.onerror = () => {
                showToast(`Failed to read ${file.name}`, 'error');
            };

            reader.readAsDataURL(file);
        });

        // Reset the file input so the same file can be uploaded again
        event.target.value = '';
    }

    function loadPhotos() {
        try {
            const stored = localStorage.getItem('realpic_photos');
            if (stored) photos = JSON.parse(stored);
        } catch (e) {
            photos = [];
        }
    }

    function renderGallery() {
        elements.photoCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

        if (photos.length === 0) {
            elements.galleryGrid.classList.add('hidden');
            elements.galleryEmpty.classList.remove('hidden');
            return;
        }

        elements.galleryEmpty.classList.add('hidden');
        elements.galleryGrid.classList.remove('hidden');

        elements.galleryGrid.innerHTML = photos.map((photo, index) => `
            <div class="gallery-item" data-index="${index}">
                <img src="${photo.data}" alt="Photo ${index + 1}">
                <div class="item-overlay">
                    <span class="item-timestamp">${formatDate(photo.timestamp)}</span>
                </div>
            </div>
        `).join('');

        elements.galleryGrid.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                openPhotoModal(parseInt(item.dataset.index));
            });
        });
    }

    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Photo Modal
    function openPhotoModal(index) {
        currentPhotoIndex = index;
        const photo = photos[index];

        elements.modalPhoto.src = photo.data;
        elements.modalTimestamp.textContent = new Date(photo.timestamp).toLocaleString();

        // Show/hide uploaded badge based on photo source
        if (photo.uploaded) {
            elements.uploadedBadgeContainer.style.display = 'flex';
        } else {
            elements.uploadedBadgeContainer.style.display = 'none';
        }

        // Reset hidden data display to placeholder
        elements.modalHiddenData.innerHTML = '<span class="placeholder-text">Click "Verify" to extract hidden data from image...</span>';

        elements.photoModal.classList.remove('hidden');
    }

    /**
     * Extracts hidden steganography data from the current photo
     */
    function extractHiddenData() {
        if (currentPhotoIndex < 0) return;

        const photo = photos[currentPhotoIndex];
        elements.modalHiddenData.innerHTML = '<span class="extracting-text">⏳ Extracting data from image pixels...</span>';

        // Create an off-screen canvas to extract image data
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = function () {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Check if image has hidden data
                if (Steganography.hasHiddenData(imageData)) {
                    const decoded = Steganography.decode(imageData);

                    if (decoded) {
                        // Parse and format the extracted data nicely
                        const formattedHtml = formatExtractedData(decoded);
                        elements.modalHiddenData.innerHTML = formattedHtml;
                    } else {
                        elements.modalHiddenData.innerHTML = '<span class="error-text">❌ Could not decode hidden data</span>';
                    }
                } else {
                    elements.modalHiddenData.innerHTML = '<span class="warning-text">⚠️ No steganography data found in this image</span>';
                }
            } catch (error) {
                console.error('Extraction error:', error);
                elements.modalHiddenData.innerHTML = '<span class="error-text">❌ Error extracting data: ' + error.message + '</span>';
            }
        };

        img.onerror = function () {
            elements.modalHiddenData.innerHTML = '<span class="error-text">❌ Failed to load image for extraction</span>';
        };

        img.src = photo.data;
    }

    /**
     * Formats extracted steganography data into readable HTML
     */
    function formatExtractedData(data) {
        // Split by the pipe separator used in buildInvisibleData
        const parts = data.split(' | ');

        let html = '<div class="extracted-data-container">';
        html += '<div class="verified-badge">✓ Verified RealPic Watermark</div>';

        parts.forEach(part => {
            if (part.startsWith('Time:')) {
                const timestamp = part.replace('Time:', '').trim();
                const date = new Date(timestamp);
                html += `<div class="data-item"><span class="data-label">📅 Timestamp:</span><span class="data-value">${date.toLocaleString()}</span></div>`;
            } else if (part.startsWith('Loc:')) {
                const coords = part.replace('Loc:', '').trim();
                html += `<div class="data-item"><span class="data-label">📍 Location:</span><span class="data-value">${coords}</span></div>`;
            } else if (part.startsWith('Device:')) {
                const deviceInfo = part.replace('Device:', '').trim();
                html += `<div class="data-item"><span class="data-label">🖥️ Device:</span><span class="data-value">${deviceInfo}</span></div>`;
            } else if (part.trim()) {
                html += `<div class="data-item"><span class="data-label">💬 Message:</span><span class="data-value">${part.trim()}</span></div>`;
            }
        });

        html += '</div>';
        return html;
    }

    function closePhotoModal() {
        elements.photoModal.classList.add('hidden');
        currentPhotoIndex = -1;
    }

    function deletePhoto() {
        if (currentPhotoIndex >= 0) {
            photos.splice(currentPhotoIndex, 1);
            savePhotos();
            closePhotoModal();
            renderGallery();
            showToast('Photo deleted', 'success');
        }
    }

    function downloadPhoto() {
        if (currentPhotoIndex >= 0) {
            const photo = photos[currentPhotoIndex];
            const link = document.createElement('a');
            link.download = `realpic_${Date.now()}.png`;
            link.href = photo.data;
            link.click();
            showToast('Photo downloaded', 'success');
        }
    }

    // Settings Functions
    function openSettings() {
        elements.visibleWatermarkText.value = settings.visibleText;
        elements.watermarkPosition.value = settings.position;
        elements.watermarkOpacity.value = settings.opacity;
        elements.watermarkSize.value = settings.size;
        elements.opacityValue.textContent = settings.opacity + '%';
        elements.sizeValue.textContent = settings.size + 'px';
        elements.invisibleWatermarkText.value = settings.invisibleText;
        elements.includeTimestamp.checked = settings.includeTimestamp;
        elements.includeLocation.checked = settings.includeLocation;
        elements.includeDeviceInfo.checked = settings.includeDeviceInfo;
        elements.settingsModal.classList.remove('hidden');
    }

    function closeSettings() {
        elements.settingsModal.classList.add('hidden');
    }

    function saveSettings() {
        settings.visibleText = elements.visibleWatermarkText.value;
        settings.position = elements.watermarkPosition.value;
        settings.opacity = parseInt(elements.watermarkOpacity.value);
        settings.size = parseInt(elements.watermarkSize.value);
        settings.invisibleText = elements.invisibleWatermarkText.value;
        settings.includeTimestamp = elements.includeTimestamp.checked;
        settings.includeLocation = elements.includeLocation.checked;
        settings.includeDeviceInfo = elements.includeDeviceInfo.checked;

        localStorage.setItem('realpic_settings', JSON.stringify(settings));

        if (settings.includeLocation) requestLocation();

        closeSettings();
        showToast('Settings saved', 'success');
    }

    function resetSettings() {
        settings = {
            visibleText: '© RealPic Lite',
            position: 'bottom-right',
            opacity: 70,
            size: 24,
            invisibleText: '',
            includeTimestamp: true,
            includeLocation: false,
            includeDeviceInfo: true
        };
        openSettings();
    }

    function loadSettings() {
        try {
            const stored = localStorage.getItem('realpic_settings');
            if (stored) settings = { ...settings, ...JSON.parse(stored) };
        } catch (e) { }
    }

    // Location
    function requestLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                },
                () => { userLocation = null; }
            );
        }
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

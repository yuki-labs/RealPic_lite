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

    // Settings
    let settings = {
        visibleText: '© RealPic Lite',
        position: 'bottom-right',
        opacity: 70,
        size: 24,
        invisibleText: '',
        includeTimestamp: true,
        includeLocation: false
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

            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            elements.cameraFeed.srcObject = currentStream;
            elements.cameraFeed.setAttribute('data-active', 'true');

            await elements.cameraFeed.play();

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

    function updateCameraStatus(message, ready = false) {
        elements.cameraStatus.classList.remove('hidden', 'ready');
        if (ready) elements.cameraStatus.classList.add('ready');
        elements.cameraStatus.querySelector('span').textContent = message;
    }

    async function switchCamera() {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        stopCamera();
        await initCamera();
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
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

        // Apply visible watermark
        Watermark.applyVisible(ctx, previewCanvas.width, previewCanvas.height, {
            text: settings.visibleText,
            position: settings.position,
            opacity: settings.opacity,
            size: settings.size
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

        if (settings.invisibleText) {
            parts.push(settings.invisibleText);
        }

        if (settings.includeTimestamp) {
            parts.push(`Time: ${new Date().toISOString()}`);
        }

        if (settings.includeLocation && userLocation) {
            parts.push(`Loc: ${userLocation.lat.toFixed(6)},${userLocation.lng.toFixed(6)}`);
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
        elements.modalHiddenData.textContent = photo.hiddenData || 'None';
        elements.photoModal.classList.remove('hidden');
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
            includeLocation: false
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

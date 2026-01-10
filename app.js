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

    // Camera device tracking
    let videoDevices = [];
    let currentDeviceIndex = 0;
    let hasMultipleCameras = false;

    // Fixed settings (not user-configurable)
    const settings = {
        visibleText: 'RealPic',
        position: 'bottom-right',
        opacity: 70,
        size: 24,
        includeTimestamp: true,
        includeUserAgent: true
    };

    // DOM Elements
    const elements = {};

    function init() {
        cacheElements();
        loadPhotos();
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
        elements.photoModal = document.getElementById('photoModal');
        elements.closePhotoBtn = document.getElementById('closePhotoBtn');
        elements.modalPhoto = document.getElementById('modalPhoto');
        elements.modalTimestamp = document.getElementById('modalTimestamp');
        elements.modalHiddenData = document.getElementById('modalHiddenData');
        elements.deletePhotoBtn = document.getElementById('deletePhotoBtn');
        elements.downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
        elements.toastContainer = document.getElementById('toastContainer');
        elements.cameraContainer = document.querySelector('.camera-container');
        elements.previewContainer = document.querySelector('.preview-container');
    }

    function bindEvents() {
        elements.captureBtn.addEventListener('click', capturePhoto);
        elements.switchCameraBtn.addEventListener('click', switchCamera);
        elements.galleryBtn.addEventListener('click', showGallery);
        elements.discardBtn.addEventListener('click', discardPhoto);
        elements.saveBtn.addEventListener('click', savePhoto);
        elements.galleryBackBtn.addEventListener('click', showCamera);
        elements.closePhotoBtn.addEventListener('click', closePhotoModal);
        elements.deletePhotoBtn.addEventListener('click', deletePhoto);
        elements.downloadPhotoBtn.addEventListener('click', downloadPhoto);

        // Close modal on overlay click
        elements.photoModal.addEventListener('click', (e) => {
            if (e.target === elements.photoModal) closePhotoModal();
        });

        // Window resize - update container size
        window.addEventListener('resize', updateContainerSize);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
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

        if (settings.includeTimestamp) {
            parts.push(`Time: ${new Date().toISOString()}`);
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

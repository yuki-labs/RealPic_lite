/**
 * RealPic Lite - Main Application
 * Camera capture with visible and invisible watermarks.
 * Supports both photo and video recording with watermarks.
 */

const App = (() => {
    // State
    let currentStream = null;
    let currentVideoDeviceId = null; // Track specific camera device
    let currentCameraLabel = null; // Track camera name for watermark
    let facingMode = 'user'; // 'environment' = rear, 'user' = front
    let currentMode = 'photo'; // 'photo' or 'video'
    let isRecording = false;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordedMimeType = 'video/webm';
    let recordingStartTime = null;
    let recordingTimerInterval = null;
    let videoRenderInterval = null;

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

        // Lazy load robust watermark in background after page is interactive
        setTimeout(loadRobustWatermark, 1000);
    }

    function loadRobustWatermark() {
        if (typeof RobustWatermark !== 'undefined') return; // Already loaded

        const script = document.createElement('script');
        script.src = 'robust-watermark.js';
        script.async = true;
        document.body.appendChild(script);
    }

    function cacheElements() {
        elements.cameraFeed = document.getElementById('cameraFeed');
        elements.captureCanvas = document.getElementById('captureCanvas');
        elements.previewCanvas = document.getElementById('previewCanvas');
        elements.videoRecordCanvas = document.getElementById('videoRecordCanvas');
        elements.cameraStatus = document.getElementById('cameraStatus');
        elements.cameraSection = document.getElementById('cameraSection');
        elements.previewSection = document.getElementById('previewSection');
        elements.captureBtn = document.getElementById('captureBtn');
        elements.captureBtnInner = document.getElementById('captureBtnInner');
        elements.switchCameraBtn = document.getElementById('switchCameraBtn');
        elements.settingsBtn = document.getElementById('settingsBtn');
        elements.discardBtn = document.getElementById('discardBtn');
        elements.saveBtn = document.getElementById('saveBtn');
        elements.settingsModal = document.getElementById('settingsModal');
        elements.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        elements.showDateTime = document.getElementById('showDateTime');
        elements.customText = document.getElementById('customText');
        elements.toastContainer = document.getElementById('toastContainer');
        elements.cameraContainer = document.querySelector('.camera-container');
        elements.previewContainer = document.querySelector('.preview-container');
        elements.previewImage = document.getElementById('previewImage');

        // Video-specific elements
        elements.photoModeBtn = document.getElementById('photoModeBtn');
        elements.videoModeBtn = document.getElementById('videoModeBtn');
        elements.recordingIndicator = document.getElementById('recordingIndicator');
        elements.recordingTime = document.getElementById('recordingTime');
        elements.videoPreviewSection = document.getElementById('videoPreviewSection');
        elements.videoPreview = document.getElementById('videoPreview');
        elements.videoPreviewContainer = document.querySelector('#videoPreviewSection .preview-container');
        elements.discardVideoBtn = document.getElementById('discardVideoBtn');
        elements.saveVideoBtn = document.getElementById('saveVideoBtn');
        elements.uploadLoading = document.getElementById('uploadLoading');
        elements.photoPreviewContainer = document.getElementById('photoPreviewContainer');
    }

    function bindEvents() {
        elements.captureBtn.addEventListener('click', handleCapture);
        elements.switchCameraBtn.addEventListener('click', switchCamera);
        elements.settingsBtn.addEventListener('click', openSettings);
        elements.discardBtn.addEventListener('click', discardPhoto);
        elements.saveBtn.addEventListener('click', downloadPhoto);
        elements.closeSettingsBtn.addEventListener('click', closeSettings);
        elements.saveSettingsBtn.addEventListener('click', saveSettings);

        // Mode toggle
        elements.photoModeBtn.addEventListener('click', () => setMode('photo'));
        elements.videoModeBtn.addEventListener('click', () => setMode('video'));

        // Video controls
        elements.discardVideoBtn.addEventListener('click', discardVideo);
        elements.saveVideoBtn.addEventListener('click', downloadVideo);

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
                handleCapture();
            }
        });
    }

    // Mode Functions
    function setMode(mode) {
        currentMode = mode;

        // Update button states
        elements.photoModeBtn.classList.toggle('active', mode === 'photo');
        elements.videoModeBtn.classList.toggle('active', mode === 'video');

        // Update capture button appearance
        elements.captureBtn.classList.toggle('video-mode', mode === 'video');

        // Update capture button inner color for video mode (red circle)
        if (mode === 'video') {
            elements.captureBtnInner.style.background = '#ef4444';
        } else {
            elements.captureBtnInner.style.background = '';
        }
    }

    function handleCapture() {
        if (currentMode === 'photo') {
            capturePhoto();
        } else {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        }
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

            // Build video constraints - use deviceId if we have one, otherwise use facingMode
            let videoConstraints;
            if (currentVideoDeviceId) {
                videoConstraints = {
                    deviceId: { exact: currentVideoDeviceId },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                };
            } else {
                videoConstraints = {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                };
            }

            // Request video first
            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false
            });

            // Store the device ID and label for future use
            const videoTrack = videoStream.getVideoTracks()[0];
            if (videoTrack) {
                currentVideoDeviceId = videoTrack.getSettings().deviceId;
                currentCameraLabel = videoTrack.label || 'Unknown Camera';
            }

            // Then request audio separately (Firefox works better this way)
            let audioStream = null;
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true
                });
            } catch (audioError) {
                console.warn('Could not get audio:', audioError);
                showToast('Microphone access denied. Videos will have no audio.', 'error');
            }

            // Combine video and audio tracks into one stream
            const combinedStream = new MediaStream();

            // Add video tracks
            videoStream.getVideoTracks().forEach(track => {
                combinedStream.addTrack(track);
            });

            // Add audio tracks if available
            if (audioStream) {
                audioStream.getAudioTracks().forEach(track => {
                    combinedStream.addTrack(track);
                });
            }

            currentStream = combinedStream;
            elements.cameraFeed.srcObject = currentStream;
            elements.cameraFeed.setAttribute('data-active', 'true');

            await elements.cameraFeed.play();

            updateCameraStatus('Ready', true);
            updateContainerSize();
            setTimeout(() => {
                elements.cameraStatus.classList.add('hidden');
            }, 2000);

        } catch (error) {
            console.error('Camera error:', error);
            // If deviceId failed, clear it and try with facingMode
            if (currentVideoDeviceId) {
                currentVideoDeviceId = null;
                return initCamera();
            }
            updateCameraStatus('Camera access denied');
            showToast('Could not access camera. Please check permissions.', 'error');
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
        container.style.maxHeight = 'calc(100vh - 250px)';

        // If container is taller than viewport allows, constrain by height
        const section = elements.cameraSection;
        if (section) {
            const availableHeight = section.clientHeight - 200;
            const containerWidth = container.clientWidth;
            const idealHeight = containerWidth / videoAspect;

            if (idealHeight > availableHeight) {
                container.style.width = `${availableHeight * videoAspect}px`;
                container.style.alignSelf = 'center';
            }
        }
    }

    async function switchCamera() {
        if (isRecording) {
            showToast('Cannot switch camera while recording', 'error');
            return;
        }

        updateCameraStatus('Switching camera...');

        // Toggle between front and rear
        const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';

        const oldStream = currentStream;

        try {
            // Request video first - always use facingMode for switching (clear deviceId)
            let videoStream = null;

            try {
                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { exact: newFacingMode },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                });
            } catch (exactError) {
                // Fallback without exact constraint
                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: newFacingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                });
            }

            // Store the new device ID for future use
            const videoTrack = videoStream.getVideoTracks()[0];
            if (videoTrack) {
                currentVideoDeviceId = videoTrack.getSettings().deviceId;
            }

            // Then request audio separately
            let audioStream = null;
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true
                });
            } catch (audioError) {
                console.warn('Could not get audio:', audioError);
            }

            // Combine video and audio tracks into one stream
            const combinedStream = new MediaStream();

            videoStream.getVideoTracks().forEach(track => {
                combinedStream.addTrack(track);
            });

            if (audioStream) {
                audioStream.getAudioTracks().forEach(track => {
                    combinedStream.addTrack(track);
                });
            }

            facingMode = newFacingMode;
            currentStream = combinedStream;
            elements.cameraFeed.srcObject = combinedStream;

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

            if (oldStream && !currentStream) {
                currentStream = oldStream;
                elements.cameraFeed.srcObject = oldStream;
            }

            showToast('Could not switch camera', 'error');
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        elements.cameraFeed.srcObject = null;
    }

    // Video Recording Functions
    function startRecording() {
        if (!currentStream) {
            showToast('Camera not ready', 'error');
            return;
        }

        try {
            const video = elements.cameraFeed;
            const canvas = elements.videoRecordCanvas;
            const ctx = canvas.getContext('2d');

            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Start rendering video frames with watermark to canvas
            function renderFrame() {
                if (!isRecording) return;

                // Draw video frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Apply watermark
                Watermark.applyVisible(ctx, canvas.width, canvas.height, {
                    text: settings.visibleText,
                    position: settings.position,
                    opacity: settings.opacity,
                    size: settings.size,
                    showDateTime: settings.showDateTime,
                    customText: settings.customText
                });

                videoRenderInterval = requestAnimationFrame(renderFrame);
            }

            // Get canvas stream at 30 FPS
            const canvasStream = canvas.captureStream(30);

            // Add audio tracks from original stream
            const audioTracks = currentStream.getAudioTracks();
            audioTracks.forEach(track => {
                canvasStream.addTrack(track);
            });

            // Determine supported mime type
            const mimeTypes = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm',
                'video/mp4'
            ];

            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }

            if (!selectedMimeType) {
                showToast('Video recording not supported on this browser', 'error');
                return;
            }

            recordedChunks = [];
            recordedMimeType = selectedMimeType;
            mediaRecorder = new MediaRecorder(canvasStream, { mimeType: selectedMimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                processRecordedVideo();
            };

            mediaRecorder.onerror = (error) => {
                console.error('MediaRecorder error:', error);
                stopRecording();
                showToast('Recording error occurred', 'error');
            };

            // Start recording
            isRecording = true;
            renderFrame(); // Start rendering watermarked frames
            mediaRecorder.start(100); // Collect data every 100ms
            recordingStartTime = Date.now();

            // Update UI
            elements.recordingIndicator.classList.remove('hidden');
            elements.captureBtnInner.classList.add('recording');
            updateRecordingTime();
            recordingTimerInterval = setInterval(updateRecordingTime, 1000);

            showToast('Recording started', 'success');

        } catch (error) {
            console.error('Error starting recording:', error);
            showToast('Could not start recording', 'error');
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            isRecording = false;

            // Stop the animation frame
            if (videoRenderInterval) {
                cancelAnimationFrame(videoRenderInterval);
                videoRenderInterval = null;
            }

            mediaRecorder.stop();

            // Update UI
            elements.recordingIndicator.classList.add('hidden');
            elements.captureBtnInner.classList.remove('recording');

            if (recordingTimerInterval) {
                clearInterval(recordingTimerInterval);
                recordingTimerInterval = null;
            }
        }
    }

    function updateRecordingTime() {
        if (!recordingStartTime) return;

        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        elements.recordingTime.textContent = `${minutes}:${seconds}`;
    }

    function processRecordedVideo() {
        if (recordedChunks.length === 0) {
            showToast('No video data recorded', 'error');
            return;
        }

        // Use the same mime type that was used for recording
        const blob = new Blob(recordedChunks, { type: recordedMimeType });
        const url = URL.createObjectURL(blob);

        // Set up the video element
        elements.videoPreview.src = url;
        elements.videoPreview.dataset.blobUrl = url;

        // Wait for video to be loadable before showing preview
        elements.videoPreview.onloadedmetadata = () => {
            showVideoPreview();
        };

        elements.videoPreview.onerror = (e) => {
            console.error('Video preview error:', e);
            showToast('Could not load video preview', 'error');
            showCamera();
        };

        // Load the video
        elements.videoPreview.load();
    }

    // Photo Capture Functions
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
            customText: settings.customText,
            cameraName: currentCameraLabel
        });

        // Apply robust invisible watermark (DCT-based, survives compression/resizing)
        const invisibleData = buildInvisibleData();
        if (invisibleData) {
            const imageData = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
            try {
                // Use RobustWatermark if loaded, otherwise fall back to LSB
                if (typeof RobustWatermark !== 'undefined') {
                    const result = RobustWatermark.encode(imageData, invisibleData);
                    ctx.putImageData(result.imageData, 0, 0);
                    console.log(`Robust watermark embedded: ${result.bitsEmbedded} bits with redundancy`);
                } else {
                    // RobustWatermark not loaded yet, use LSB
                    console.log('RobustWatermark not loaded, using LSB steganography');
                    const encodedData = Steganography.encode(imageData, invisibleData);
                    ctx.putImageData(encodedData, 0, 0);
                }
            } catch (error) {
                console.warn('Watermark encoding failed, falling back to LSB:', error);
                // Fallback to basic steganography if robust fails
                try {
                    const encodedData = Steganography.encode(imageData, invisibleData);
                    ctx.putImageData(encodedData, 0, 0);
                } catch (fallbackError) {
                    console.warn('All watermarking methods failed:', fallbackError);
                }
            }
        }

        showPhotoPreview();
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

        // Always include camera name if available
        if (currentCameraLabel) {
            parts.push(`Camera: ${currentCameraLabel}`);
        }

        return parts.length > 0 ? parts.join(' | ') : null;
    }

    // View Functions
    async function showPhotoPreview() {
        elements.cameraSection.classList.add('hidden');
        elements.previewSection.classList.remove('hidden');
        stopCamera();

        const canvas = elements.previewCanvas;

        // Set container size during loading (based on canvas aspect ratio)
        if (elements.photoPreviewContainer) {
            const container = elements.photoPreviewContainer;
            // Calculate size that fits in viewport while maintaining aspect ratio
            const maxWidth = Math.min(canvas.width, window.innerWidth - 32);
            const maxHeight = Math.min(canvas.height, window.innerHeight - 250);
            const aspectRatio = canvas.width / canvas.height;

            let width, height;
            if (maxWidth / aspectRatio <= maxHeight) {
                width = maxWidth;
                height = maxWidth / aspectRatio;
            } else {
                height = maxHeight;
                width = maxHeight * aspectRatio;
            }

            container.style.width = `${width}px`;
            container.style.height = `${height}px`;
        }

        // Show loading overlay
        elements.previewImage.src = '';
        elements.previewImage.style.display = 'none';
        if (elements.uploadLoading) {
            elements.uploadLoading.classList.remove('hidden');
        }

        // Upload and wait for shareable URL
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const formData = new FormData();
            formData.append('image', blob, 'photo.png');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                // Use raw image URL for the preview (context menu gives direct link)
                const imageUrl = data.data.url;
                const sharePageUrl = data.data.fullUrl.trim();

                // Set image src to the raw image
                elements.previewImage.src = imageUrl;
                elements.previewImage.alt = 'Captured photo';

                // Store share URL for copy functionality
                elements.previewImage.dataset.shareUrl = sharePageUrl;

                console.log('Photo uploaded for sharing:', sharePageUrl);
                showToast('Photo ready to share!', 'success');
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            // Fallback to data URL if upload fails
            elements.previewImage.src = canvas.toDataURL('image/png');
            elements.previewImage.alt = 'Captured photo (not shareable)';
            showToast('Upload failed - image not shareable', 'error');
        }

        // Hide loading overlay and show image
        if (elements.uploadLoading) {
            elements.uploadLoading.classList.add('hidden');
        }
        elements.previewImage.style.display = 'block';

        // Reset container size - let CSS handle final sizing based on image
        if (elements.photoPreviewContainer) {
            elements.photoPreviewContainer.style.width = '';
            elements.photoPreviewContainer.style.height = '';
        }
    }

    function showVideoPreview() {
        elements.cameraSection.classList.add('hidden');
        elements.videoPreviewSection.classList.remove('hidden');
        stopCamera();
        updateVideoPreviewContainerSize();
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

    // Update video preview container size to match video dimensions
    function updateVideoPreviewContainerSize() {
        const video = elements.videoPreview;
        const container = elements.videoPreviewContainer;

        if (!video || !container) return;

        // Wait for video to have dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            setTimeout(updateVideoPreviewContainerSize, 100);
            return;
        }

        // Set the container's aspect ratio to match the video
        container.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        container.style.flex = 'none';
        container.style.width = '100%';
        container.style.maxHeight = 'calc(100vh - 200px)';

        // If container is taller than viewport allows, constrain by height
        const section = elements.videoPreviewSection;
        if (section) {
            const videoAspect = video.videoWidth / video.videoHeight;
            const availableHeight = section.clientHeight - 150;
            const containerWidth = container.clientWidth;
            const idealHeight = containerWidth / videoAspect;

            if (idealHeight > availableHeight) {
                container.style.width = `${availableHeight * videoAspect}px`;
                container.style.alignSelf = 'center';
            }
        }
    }

    function showCamera() {
        elements.previewSection.classList.add('hidden');
        elements.videoPreviewSection.classList.add('hidden');
        elements.cameraSection.classList.remove('hidden');
        initCamera();
    }

    function discardPhoto() {
        showCamera();
    }

    function discardVideo() {
        // Clear event handlers to prevent error toast when clearing src
        elements.videoPreview.onloadedmetadata = null;
        elements.videoPreview.onerror = null;

        // Clean up blob URL
        if (elements.videoPreview.dataset.blobUrl) {
            URL.revokeObjectURL(elements.videoPreview.dataset.blobUrl);
            delete elements.videoPreview.dataset.blobUrl;
        }
        elements.videoPreview.src = '';
        recordedChunks = [];
        showCamera();
    }

    // Download Functions
    function downloadPhoto() {
        const dataUrl = elements.previewCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `realpic_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        showToast('Photo downloaded!', 'success');
        showCamera();
    }

    function downloadVideo() {
        if (recordedChunks.length === 0) {
            showToast('No video to download', 'error');
            return;
        }

        const blob = new Blob(recordedChunks, { type: recordedMimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `realpic_${Date.now()}.webm`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        showToast('Video downloaded!', 'success');
        discardVideo();
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

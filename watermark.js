/**
 * RealPic Lite - Visible Watermark Module
 * Applies visible text watermarks with device/metadata info
 */

const Watermark = (() => {
    /**
     * Applies a visible watermark to the canvas context
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} options - Watermark options
     * @param {string} options.text - Main watermark text (e.g., "© RealPic Lite")
     * @param {string} options.position - Position: 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'
     * @param {number} options.opacity - Opacity 0-100
     * @param {number} options.size - Font size in pixels
     * @param {string[]} [options.metadata] - Additional metadata lines to display
     */
    function applyVisible(ctx, width, height, options) {
        const {
            text = '© RealPic Lite',
            position = 'bottom-right',
            opacity = 70,
            size = 24,
            metadata = []
        } = options;

        if (!text && metadata.length === 0) return;

        // Save context state
        ctx.save();

        // Calculate padding based on canvas size
        const padding = Math.max(20, Math.min(width, height) * 0.03);
        const lineHeight = size * 1.3;
        const metaSize = Math.max(12, size * 0.55); // Smaller size for metadata
        const metaLineHeight = metaSize * 1.2;

        // Set up text styling for main watermark
        ctx.font = `600 ${size}px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textBaseline = 'bottom';

        // Measure text dimensions
        const mainTextWidth = text ? ctx.measureText(text).width : 0;

        // Calculate metadata dimensions
        ctx.font = `400 ${metaSize}px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        let maxMetaWidth = 0;
        metadata.forEach(line => {
            const lineWidth = ctx.measureText(line).width;
            if (lineWidth > maxMetaWidth) maxMetaWidth = lineWidth;
        });

        // Total block dimensions
        const blockWidth = Math.max(mainTextWidth, maxMetaWidth);
        const blockHeight = (text ? lineHeight : 0) + (metadata.length * metaLineHeight);

        // Calculate position
        let x, y;
        let textAlign = 'left';

        switch (position) {
            case 'top-left':
                x = padding;
                y = padding + (text ? lineHeight : metaLineHeight);
                textAlign = 'left';
                break;
            case 'top-right':
                x = width - padding;
                y = padding + (text ? lineHeight : metaLineHeight);
                textAlign = 'right';
                break;
            case 'bottom-left':
                x = padding;
                y = height - padding - (metadata.length * metaLineHeight);
                textAlign = 'left';
                break;
            case 'center':
                x = width / 2;
                y = height / 2 - (blockHeight / 2) + (text ? lineHeight : metaLineHeight);
                textAlign = 'center';
                break;
            case 'bottom-right':
            default:
                x = width - padding;
                y = height - padding - (metadata.length * metaLineHeight);
                textAlign = 'right';
                break;
        }

        ctx.textAlign = textAlign;

        // Apply opacity
        const alpha = opacity / 100;

        // Draw background box for better readability
        const bgPadding = 10;
        let bgX, bgY, bgWidth, bgHeight;

        bgWidth = blockWidth + (bgPadding * 2);
        bgHeight = blockHeight + (bgPadding * 2);

        switch (textAlign) {
            case 'right':
                bgX = x - blockWidth - bgPadding;
                break;
            case 'center':
                bgX = x - (blockWidth / 2) - bgPadding;
                break;
            default:
                bgX = x - bgPadding;
        }
        bgY = y - (text ? lineHeight : metaLineHeight) - bgPadding + 5;

        // Draw semi-transparent background
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 8);
        ctx.fill();

        // Draw main watermark text
        if (text) {
            ctx.font = `600 ${size}px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

            // Shadow for better visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillText(text, x, y);
        }

        // Draw metadata lines
        if (metadata.length > 0) {
            ctx.font = `400 ${metaSize}px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
            ctx.shadowBlur = 2;

            let metaY = y + (text ? 5 : 0); // Start after main text

            metadata.forEach(line => {
                metaY += metaLineHeight;
                ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.9})`;
                ctx.fillText(line, x, metaY);
            });
        }

        // Restore context state
        ctx.restore();
    }

    /**
     * Builds metadata lines array from settings
     * @param {Object} options
     * @param {boolean} options.includeTimestamp
     * @param {boolean} options.includeLocation
     * @param {boolean} options.includeDeviceInfo
     * @param {Object|null} options.location - { lat, lng }
     * @param {Object|null} options.deviceInfo - Device info object
     * @returns {string[]} Array of metadata lines
     */
    function buildMetadataLines(options) {
        const {
            includeTimestamp = true,
            includeLocation = false,
            includeDeviceInfo = true,
            location = null,
            deviceInfo = null
        } = options;

        const lines = [];

        // Timestamp line
        if (includeTimestamp) {
            const now = new Date();
            const dateStr = now.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const timeStr = now.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            lines.push(`📅 ${dateStr} ${timeStr}`);
        }

        // Location line
        if (includeLocation && location) {
            lines.push(`📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
        }

        // Device info line
        if (includeDeviceInfo && deviceInfo) {
            const deviceParts = [];

            // Device name (specific model like "iPhone 15 Pro", "Windows PC", etc.)
            if (deviceInfo.device && deviceInfo.device !== 'Unknown Device') {
                deviceParts.push(deviceInfo.device);
            } else if (deviceInfo.platform && deviceInfo.platform !== 'Unknown') {
                // Fallback to platform if device not detected
                deviceParts.push(deviceInfo.platform);
            }

            // Browser
            if (deviceInfo.browser && deviceInfo.browser !== 'Unknown') {
                deviceParts.push(`${deviceInfo.browser}${deviceInfo.browserVersion ? ' ' + deviceInfo.browserVersion : ''}`);
            }

            // OS (only if not already implied by device name)
            const deviceLower = (deviceInfo.device || '').toLowerCase();
            const shouldShowOS = !deviceLower.includes('iphone') &&
                !deviceLower.includes('ipad') &&
                !deviceLower.includes('mac') &&
                !deviceLower.includes('windows') &&
                !deviceLower.includes('chromebook') &&
                !deviceLower.includes('linux');

            if (shouldShowOS && deviceInfo.os && deviceInfo.os !== 'Unknown') {
                deviceParts.push(`${deviceInfo.os}${deviceInfo.osVersion ? ' ' + deviceInfo.osVersion : ''}`);
            }

            if (deviceParts.length > 0) {
                lines.push(`🖥️ ${deviceParts.join(' • ')}`);
            }

            // Camera on separate line if present
            if (deviceInfo.camera && deviceInfo.camera !== 'Unknown') {
                // Truncate long camera names
                let cameraName = deviceInfo.camera;
                if (cameraName.length > 40) {
                    cameraName = cameraName.substring(0, 37) + '...';
                }
                lines.push(`📷 ${cameraName}`);
            }
        }

        return lines;
    }

    return {
        applyVisible,
        buildMetadataLines
    };
})();

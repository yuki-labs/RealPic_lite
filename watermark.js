/**
 * Watermark Module
 * Handles visible watermark rendering on canvas.
 */

const Watermark = (() => {
    const defaultSettings = {
        text: 'RealPic',
        position: 'bottom-right',
        opacity: 70,
        size: 24,
        fontFamily: 'Inter, sans-serif',
        color: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.8)'
    };

    /**
     * Applies visible watermark to canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} settings - Watermark settings
     */
    function applyVisible(ctx, width, height, settings = {}) {
        const config = { ...defaultSettings, ...settings };

        if (!config.text || config.text.trim() === '') return;

        const fontSize = Math.max(12, Math.min(config.size, 72));
        const secondaryFontSize = Math.max(8, fontSize * 0.45);
        const opacity = config.opacity / 100;
        const padding = fontSize * 1.5;
        const lineSpacing = fontSize * 0.3;

        // Build lines array
        const lines = [];

        // Line 1: Main text (RealPic)
        lines.push({ text: config.text, fontSize: fontSize, fontWeight: 500 });

        // Line 2: Date/Time (if enabled)
        if (config.showDateTime) {
            const now = new Date();
            const dateTimeStr = now.toLocaleString();
            lines.push({ text: dateTimeStr, fontSize: secondaryFontSize, fontWeight: 400 });
        }

        // Line 3: Custom text (if provided)
        if (config.customText && config.customText.trim() !== '') {
            lines.push({ text: config.customText.trim(), fontSize: secondaryFontSize, fontWeight: 400 });
        }

        // Line 4: User Agent
        const userAgent = navigator.userAgent;
        lines.push({ text: userAgent, fontSize: secondaryFontSize, fontWeight: 400 });

        // Line 5: Camera name (if provided)
        if (config.cameraName && config.cameraName.trim() !== '') {
            lines.push({ text: `📷 ${config.cameraName.trim()}`, fontSize: secondaryFontSize, fontWeight: 400 });
        }

        ctx.save();
        ctx.globalAlpha = opacity;

        // Shadow for visibility on any background
        ctx.shadowColor = config.shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = config.color;

        // Calculate total height for all lines
        let totalHeight = 0;
        for (let i = 0; i < lines.length; i++) {
            totalHeight += lines[i].fontSize;
            if (i < lines.length - 1) totalHeight += lineSpacing;
        }

        let x, startY, textAlign;

        switch (config.position) {
            case 'top-left':
                x = padding;
                startY = padding + lines[0].fontSize / 2;
                textAlign = 'left';
                break;
            case 'top-right':
                x = width - padding;
                startY = padding + lines[0].fontSize / 2;
                textAlign = 'right';
                break;
            case 'bottom-left':
                x = padding;
                startY = height - padding - totalHeight + lines[0].fontSize / 2;
                textAlign = 'left';
                break;
            case 'bottom-right':
                x = width - padding;
                startY = height - padding - totalHeight + lines[0].fontSize / 2;
                textAlign = 'right';
                break;
            case 'center':
                x = width / 2;
                startY = height / 2 - totalHeight / 2 + lines[0].fontSize / 2;
                textAlign = 'center';
                break;
            default:
                x = width - padding;
                startY = height - padding - totalHeight + lines[0].fontSize / 2;
                textAlign = 'right';
        }

        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';

        // Draw each line
        let currentY = startY;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            ctx.font = `${line.fontWeight} ${line.fontSize}px ${config.fontFamily}`;
            ctx.fillText(line.text, x, currentY);

            if (i < lines.length - 1) {
                currentY += line.fontSize / 2 + lineSpacing + lines[i + 1].fontSize / 2;
            }
        }

        ctx.restore();
    }

    return { applyVisible, defaultSettings };
})();

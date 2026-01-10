/**
 * Watermark Module
 * Handles visible watermark rendering on canvas.
 */

const Watermark = (() => {
    const defaultSettings = {
        text: '© RealPic Lite',
        position: 'bottom-right',
        opacity: 70,
        size: 24,
        fontFamily: 'Inter, sans-serif',
        color: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.8)',
        dataText: null // Additional data text to show below main text
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
        const dataFontSize = Math.max(10, fontSize * 0.5); // Smaller font for data
        const opacity = config.opacity / 100;
        const padding = fontSize * 1.5;
        const lineSpacing = fontSize * 0.4; // Space between main text and data

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = `500 ${fontSize}px ${config.fontFamily}`;
        ctx.textBaseline = 'middle';

        // Calculate total height including data text
        const mainTextHeight = fontSize;
        const dataTextHeight = config.dataText ? dataFontSize : 0;
        const totalHeight = mainTextHeight + (config.dataText ? lineSpacing + dataTextHeight : 0);

        let x, y;
        let textAlign;

        switch (config.position) {
            case 'top-left':
                x = padding;
                y = padding + mainTextHeight / 2;
                textAlign = 'left';
                break;
            case 'top-right':
                x = width - padding;
                y = padding + mainTextHeight / 2;
                textAlign = 'right';
                break;
            case 'bottom-left':
                x = padding;
                y = height - padding - totalHeight + mainTextHeight / 2;
                textAlign = 'left';
                break;
            case 'bottom-right':
                x = width - padding;
                y = height - padding - totalHeight + mainTextHeight / 2;
                textAlign = 'right';
                break;
            case 'center':
                x = width / 2;
                y = height / 2 - (config.dataText ? (lineSpacing + dataTextHeight) / 2 : 0);
                textAlign = 'center';
                break;
            default:
                x = width - padding;
                y = height - padding - totalHeight + mainTextHeight / 2;
                textAlign = 'right';
        }

        ctx.textAlign = textAlign;

        // Shadow for visibility on any background
        ctx.shadowColor = config.shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Draw main watermark text
        ctx.fillStyle = config.color;
        ctx.fillText(config.text, x, y);

        // Draw data text below main text if provided
        if (config.dataText) {
            const dataY = y + mainTextHeight / 2 + lineSpacing + dataFontSize / 2;

            ctx.font = `400 ${dataFontSize}px ${config.fontFamily}`;
            ctx.globalAlpha = opacity * 0.85; // Slightly more transparent

            // Split long data text into multiple lines if needed
            const maxWidth = width - padding * 2;
            const lines = wrapText(ctx, config.dataText, maxWidth);

            lines.forEach((line, index) => {
                const lineY = dataY + (index * (dataFontSize + 4));
                ctx.fillText(line, x, lineY);
            });
        }

        ctx.restore();
    }

    /**
     * Wraps text into multiple lines based on max width
     */
    function wrapText(ctx, text, maxWidth) {
        // Split by pipe separator first
        const segments = text.split(' | ');
        const lines = [];
        let currentLine = '';

        segments.forEach((segment, index) => {
            const testLine = currentLine ? currentLine + ' • ' + segment : segment;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = segment;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        // Limit to 3 lines max
        return lines.slice(0, 3);
    }

    /**
     * Applies diagonal repeating watermark pattern
     */
    function applyPattern(ctx, width, height, settings = {}) {
        const config = { ...defaultSettings, ...settings, opacity: 15 };
        if (!config.text) return;

        const fontSize = config.size * 0.75;
        ctx.save();
        ctx.globalAlpha = config.opacity / 100;
        ctx.font = `400 ${fontSize}px ${config.fontFamily}`;
        ctx.fillStyle = config.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const spacing = fontSize * 8;
        ctx.rotate(-30 * Math.PI / 180);

        for (let y = -height; y < height * 2; y += spacing) {
            for (let x = -width; x < width * 2; x += spacing) {
                ctx.fillText(config.text, x, y);
            }
        }

        ctx.restore();
    }

    return { applyVisible, applyPattern, defaultSettings };
})();

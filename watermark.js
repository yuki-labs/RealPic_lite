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
        const opacity = config.opacity / 100;
        const padding = fontSize * 1.5;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = `500 ${fontSize}px ${config.fontFamily}`;
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(config.text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        let x, y;

        switch (config.position) {
            case 'top-left':
                x = padding;
                y = padding + textHeight / 2;
                ctx.textAlign = 'left';
                break;
            case 'top-right':
                x = width - padding;
                y = padding + textHeight / 2;
                ctx.textAlign = 'right';
                break;
            case 'bottom-left':
                x = padding;
                y = height - padding - textHeight / 2;
                ctx.textAlign = 'left';
                break;
            case 'bottom-right':
                x = width - padding;
                y = height - padding - textHeight / 2;
                ctx.textAlign = 'right';
                break;
            case 'center':
                x = width / 2;
                y = height / 2;
                ctx.textAlign = 'center';
                break;
            default:
                x = width - padding;
                y = height - padding - textHeight / 2;
                ctx.textAlign = 'right';
        }

        // Shadow for visibility on any background
        ctx.shadowColor = config.shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = config.color;
        ctx.fillText(config.text, x, y);

        ctx.restore();
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

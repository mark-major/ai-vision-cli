"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageAnnotator = void 0;
const sharp_1 = __importDefault(require("sharp"));
class ImageAnnotator {
    options;
    defaultOptions = {
        color: 'red',
        lineWidth: 3,
        fontSize: 16,
        showLabels: true,
        showConfidence: false,
        labelBackground: true,
    };
    constructor(options = {}) {
        this.options = options;
        this.options = { ...this.defaultOptions, ...options };
    }
    async createAnnotatedImage(inputPath, objects, outputPath, options) {
        const opts = { ...this.options, ...options };
        if (objects.length === 0) {
            await this.copyImage(inputPath, outputPath);
            return outputPath;
        }
        try {
            const image = (0, sharp_1.default)(inputPath);
            const metadata = await image.metadata();
            const svgOverlay = this.createSVGOverlay(metadata.width, metadata.height, objects, opts);
            await image
                .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
                .toFile(outputPath);
            return outputPath;
        }
        catch (error) {
            throw new Error(`Failed to create annotated image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    createSVGOverlay(width, height, objects, options) {
        const svgElements = [];
        objects.forEach((obj) => {
            const bbox = obj.normalized_box_2d;
            const pixelBbox = this.normalizeToPixel(bbox, width, height);
            const rect = this.createRectangle(pixelBbox, options);
            svgElements.push(rect);
            if (options.showLabels) {
                const label = this.createLabel(pixelBbox, obj, options);
                svgElements.push(label);
            }
        });
        return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bbox { stroke: ${options.color}; stroke-width: ${options.lineWidth}; fill: none; }
    .label-text { font-family: Arial, sans-serif; font-size: ${options.fontSize}px; fill: ${options.color}; }
    .label-bg { fill: white; fill-opacity: 0.9; rx: 4; }
  </style>
  ${svgElements.join('\n  ')}
</svg>`;
    }
    createRectangle(bbox, _options) {
        const { x, y, width, height } = bbox;
        return `<rect class="bbox" x="${x}" y="${y}" width="${width}" height="${height}" />`;
    }
    createLabel(bbox, obj, options) {
        const { x, y } = bbox;
        const labelText = this.formatLabelText(obj, options);
        const labelY = Math.max(0, y - 25);
        const labelX = x;
        if (options.labelBackground) {
            const textWidth = this.estimateTextWidth(labelText, options.fontSize);
            const bgHeight = options.fontSize + 8;
            const bgX = Math.max(0, labelX - 4);
            const bgY = labelY - options.fontSize - 4;
            return `
    <rect class="label-bg" x="${bgX}" y="${bgY}" width="${textWidth + 8}" height="${bgHeight}" />
    <text class="label-text" x="${labelX}" y="${labelY}" text-anchor="start">${labelText}</text>`;
        }
        return `<text class="label-text" x="${labelX}" y="${labelY}" text-anchor="start">${labelText}</text>`;
    }
    formatLabelText(obj, options) {
        let label = obj.label || obj.object;
        if (options.showConfidence && obj.confidence !== undefined) {
            label += ` (${Math.round(obj.confidence * 100)}%)`;
        }
        const maxLength = 50;
        if (label.length > maxLength) {
            label = label.substring(0, maxLength - 3) + '...';
        }
        return label;
    }
    estimateTextWidth(text, fontSize) {
        return Math.round(text.length * fontSize * 0.6);
    }
    normalizeToPixel(normalizedBox, width, height) {
        const [ymin, xmin, ymax, xmax] = normalizedBox;
        return {
            x: Math.round((xmin / 1000) * width),
            y: Math.round((ymin / 1000) * height),
            width: Math.round(((xmax - xmin) / 1000) * width),
            height: Math.round(((ymax - ymin) / 1000) * height),
        };
    }
    async copyImage(inputPath, outputPath) {
        await (0, sharp_1.default)(inputPath).toFile(outputPath);
    }
    generateCSSSelector(object) {
        const objType = object.object.toLowerCase();
        const label = object.label.toLowerCase();
        if (objType === 'button') {
            return 'button';
        }
        else if (objType === 'input') {
            if (label.includes('text'))
                return 'input[type="text"]';
            if (label.includes('email'))
                return 'input[type="email"]';
            if (label.includes('password'))
                return 'input[type="password"]';
            if (label.includes('submit'))
                return 'input[type="submit"]';
            return 'input';
        }
        else if (objType === 'a') {
            return 'a';
        }
        else if (objType === 'img') {
            return 'img';
        }
        else if (objType === 'nav') {
            return 'nav';
        }
        else if (objType === 'header') {
            return 'header';
        }
        else if (objType === 'section') {
            return 'section';
        }
        else if (objType.match(/^h[1-6]$/)) {
            return objType;
        }
        else if (objType === 'p') {
            return 'p';
        }
        else if (objType === 'div') {
            return 'div';
        }
        else if (objType === 'span') {
            return 'span';
        }
        else {
            const className = label.replace(/\s+/g, '-').toLowerCase();
            return `.${className}`;
        }
    }
    generateAdvancedCSSSelector(object, context) {
        const baseSelector = this.generateCSSSelector(object);
        const attributes = [];
        if (object.label) {
            const label = object.label.toLowerCase();
            if (label.includes('click') || label.includes('submit')) {
                attributes.push('[onclick]');
            }
            if (label.includes('link') || baseSelector === 'a') {
                attributes.push('[href]');
            }
            if (label.includes('form') || label.includes('input')) {
                attributes.push('[form]');
            }
            if (label.includes('disabled')) {
                attributes.push('[disabled]');
            }
        }
        const fullSelector = attributes.length > 0
            ? `${baseSelector}${attributes.join('')}`
            : baseSelector;
        return context ? `${context} ${fullSelector}` : fullSelector;
    }
}
exports.ImageAnnotator = ImageAnnotator;
//# sourceMappingURL=imageAnnotator.js.map
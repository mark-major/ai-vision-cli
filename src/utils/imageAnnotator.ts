/**
 * Image annotation utilities for object detection
 * Ported from MCP project with CLI enhancements
 */

import sharp from 'sharp';
import type { DetectedObject } from '../types/ObjectDetection.js';
import type { BoundingBox } from '../types/Analysis.js';

export interface AnnotationOptions {
  color?: string;
  lineWidth?: number;
  fontSize?: number;
  showLabels?: boolean;
  showConfidence?: boolean;
  labelBackground?: boolean;
}


export class ImageAnnotator {
  private readonly defaultOptions: AnnotationOptions = {
    color: 'red',
    lineWidth: 3,
    fontSize: 16,
    showLabels: true,
    showConfidence: false,
    labelBackground: true,
  };

  constructor(private options: AnnotationOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Create an annotated image with bounding boxes and labels
   */
  async createAnnotatedImage(
    inputPath: string,
    objects: DetectedObject[],
    outputPath: string,
    options?: AnnotationOptions
  ): Promise<string> {
    const opts = { ...this.options, ...options };

    if (objects.length === 0) {
      // No objects to annotate, just copy the image
      await this.copyImage(inputPath, outputPath);
      return outputPath;
    }

    try {
      // Load the original image
      let image = sharp(inputPath);
      const metadata = await image.metadata();

      // Create overlay with SVG
      const svgOverlay = this.createSVGOverlay(
        metadata.width!,
        metadata.height!,
        objects,
        opts
      );

      // Apply the overlay
      await image
        .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to create annotated image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create SVG overlay with bounding boxes
   */
  private createSVGOverlay(
    width: number,
    height: number,
    objects: DetectedObject[],
    options: AnnotationOptions
  ): string {
    const svgElements: string[] = [];

    objects.forEach((obj) => {
      const bbox = obj.normalized_box_2d;
      const pixelBbox = this.normalizeToPixel(bbox, width, height);

      // Create bounding box rectangle
      const rect = this.createRectangle(pixelBbox, options);
      svgElements.push(rect);

      // Create label if enabled
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

  /**
   * Create SVG rectangle for bounding box
   */
  private createRectangle(bbox: BoundingBox, _options: AnnotationOptions): string {
    const { x, y, width, height } = bbox;
    return `<rect class="bbox" x="${x}" y="${y}" width="${width}" height="${height}" />`;
  }

  /**
   * Create SVG text label
   */
  private createLabel(
    bbox: BoundingBox,
    obj: DetectedObject,
    options: AnnotationOptions
  ): string {
    const { x, y } = bbox;
    const labelText = this.formatLabelText(obj, options);

    // Position label above the bounding box
    const labelY = Math.max(0, y - 25);
    const labelX = x;

    if (options.labelBackground) {
      // Create background rectangle for better readability
      const textWidth = this.estimateTextWidth(labelText, options.fontSize!);
      const bgHeight = options.fontSize! + 8;
      const bgX = Math.max(0, labelX - 4);
      const bgY = labelY - options.fontSize! - 4;

      return `
    <rect class="label-bg" x="${bgX}" y="${bgY}" width="${textWidth + 8}" height="${bgHeight}" />
    <text class="label-text" x="${labelX}" y="${labelY}" text-anchor="start">${labelText}</text>`;
    }

    return `<text class="label-text" x="${labelX}" y="${labelY}" text-anchor="start">${labelText}</text>`;
  }

  /**
   * Format label text based on object and options
   */
  private formatLabelText(obj: DetectedObject, options: AnnotationOptions): string {
    let label = obj.label || obj.object;

    if (options.showConfidence && obj.confidence !== undefined) {
      label += ` (${Math.round(obj.confidence * 100)}%)`;
    }

    // Truncate if too long
    const maxLength = 50;
    if (label.length > maxLength) {
      label = label.substring(0, maxLength - 3) + '...';
    }

    return label;
  }

  /**
   * Estimate text width for background sizing
   */
  private estimateTextWidth(text: string, fontSize: number): number {
    // Rough estimation: average character width is 0.6 * font size
    return Math.round(text.length * fontSize * 0.6);
  }

  /**
   * Convert normalized coordinates (0-1000) to pixel coordinates
   */
  private normalizeToPixel(normalizedBox: [number, number, number, number], width: number, height: number): BoundingBox {
    const [ymin, xmin, ymax, xmax] = normalizedBox;
    return {
      x: Math.round((xmin / 1000) * width),
      y: Math.round((ymin / 1000) * height),
      width: Math.round(((xmax - xmin) / 1000) * width),
      height: Math.round(((ymax - ymin) / 1000) * height),
    };
  }

  /**
   * Copy image without annotations (fallback)
   */
  private async copyImage(inputPath: string, outputPath: string): Promise<void> {
    await sharp(inputPath).toFile(outputPath);
  }

  /**
   * Generate CSS selectors for web elements
   */
  generateCSSSelector(object: DetectedObject): string {
    const objType = object.object.toLowerCase();
    const label = object.label.toLowerCase();

    // Generate CSS selectors based on detected element type
    if (objType === 'button') {
      return 'button';
    } else if (objType === 'input') {
      if (label.includes('text')) return 'input[type="text"]';
      if (label.includes('email')) return 'input[type="email"]';
      if (label.includes('password')) return 'input[type="password"]';
      if (label.includes('submit')) return 'input[type="submit"]';
      return 'input';
    } else if (objType === 'a') {
      return 'a';
    } else if (objType === 'img') {
      return 'img';
    } else if (objType === 'nav') {
      return 'nav';
    } else if (objType === 'header') {
      return 'header';
    } else if (objType === 'section') {
      return 'section';
    } else if (objType.match(/^h[1-6]$/)) {
      return objType;
    } else if (objType === 'p') {
      return 'p';
    } else if (objType === 'div') {
      return 'div';
    } else if (objType === 'span') {
      return 'span';
    } else {
      // Fallback to class or ID-based selectors
      const className = label.replace(/\s+/g, '-').toLowerCase();
      return `.${className}`;
    }
  }

  /**
   * Generate enhanced CSS selector with attributes
   */
  generateAdvancedCSSSelector(object: DetectedObject, context?: string): string {
    const baseSelector = this.generateCSSSelector(object);
    const attributes: string[] = [];

    // Add common attributes based on label
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

    // Combine selector with attributes
    const fullSelector = attributes.length > 0
      ? `${baseSelector}${attributes.join('')}`
      : baseSelector;

    // Add context if provided
    return context ? `${context} ${fullSelector}` : fullSelector;
  }
}
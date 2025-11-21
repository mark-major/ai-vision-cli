import type { DetectedObject } from '../types/ObjectDetection.js';
export interface AnnotationOptions {
    color?: string;
    lineWidth?: number;
    fontSize?: number;
    showLabels?: boolean;
    showConfidence?: boolean;
    labelBackground?: boolean;
}
export declare class ImageAnnotator {
    private options;
    private readonly defaultOptions;
    constructor(options?: AnnotationOptions);
    createAnnotatedImage(inputPath: string, objects: DetectedObject[], outputPath: string, options?: AnnotationOptions): Promise<string>;
    private createSVGOverlay;
    private createRectangle;
    private createLabel;
    private formatLabelText;
    private estimateTextWidth;
    private normalizeToPixel;
    private copyImage;
    generateCSSSelector(object: DetectedObject): string;
    generateAdvancedCSSSelector(object: DetectedObject, context?: string): string;
}
//# sourceMappingURL=imageAnnotator.d.ts.map
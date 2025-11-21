"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectObjectsCommand = exports.detectCommand = void 0;
const commander_1 = require("commander");
const VisionService_js_1 = require("../services/VisionService.js");
const output_formatter_js_1 = require("../utils/output-formatter.js");
const progress_js_1 = require("../utils/progress.js");
const error_handler_js_1 = require("../utils/error-handler.js");
const imageAnnotator_js_1 = require("../utils/imageAnnotator.js");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
exports.detectCommand = new commander_1.Command('detect')
    .description('Detect objects in images with AI-powered analysis');
exports.detectObjectsCommand = new commander_1.Command('objects')
    .description('Detect objects in an image with bounding boxes')
    .argument('<image>', 'Image file path or URL')
    .option('-p, --prompt <prompt>', 'Detection prompt', 'Detect all objects in this image')
    .option('-o, --output <format>', 'Output format (json|text|table)', 'json')
    .option('-s, --save <path>', 'Save output to file')
    .option('--save-image <path>', 'Save annotated image to file')
    .option('--annotation-color <color>', 'Bounding box color (red, green, blue, yellow)', 'red')
    .option('--min-confidence <value>', 'Minimum confidence threshold (0-1)', parseFloat)
    .option('--max-objects <count>', 'Maximum number of objects to detect', parseInt)
    .option('--web-context', 'Enable web context-aware detection')
    .option('--no-annotations', 'Disable visual annotations')
    .option('-t, --temperature <temp>', 'AI temperature (0-1)', parseFloat)
    .option('--max-tokens <tokens>', 'Maximum output tokens', parseInt)
    .option('--top-p <value>', 'Top P value (0-1)', parseFloat)
    .option('--top-k <value>', 'Top K value (1-100)', parseInt)
    .option('--system-instruction <instruction>', 'Custom system instruction')
    .option('--force-upload', 'Force file upload instead of inline data')
    .option('--files-threshold <bytes>', 'Custom file upload threshold', parseInt)
    .option('--no-progress', 'Disable progress indicators', false)
    .option('--verbose', 'Enable detailed debug output')
    .option('--provider <provider>', 'AI provider (google|vertex_ai)')
    .action(async (image, options) => {
    const progress = new progress_js_1.ProgressManager(options.noProgress);
    const output = new output_formatter_js_1.OutputFormatter({
        format: options.output || 'json',
        pretty: true,
        colors: true
    });
    try {
        progress.startGlobal('Detecting objects');
        const visionService = VisionService_js_1.VisionService.getInstance();
        const analysisOptions = {
            functionName: 'detect_objects_in_image',
            temperature: options.temperature || 0,
            maxTokens: options.maxTokens || 2048,
            topP: options.topP,
            topK: options.topK,
            systemInstruction: options.systemInstruction || getDefaultSystemInstruction(options.webContext),
            enableFileUpload: options.forceUpload,
            filesThreshold: options.filesThreshold,
            includeMetadata: true,
            debugMode: options.verbose || process.env.LOG_LEVEL === 'debug',
            responseSchema: createDetectionSchema('google'),
        };
        if (options.verbose) {
            console.log('\n--- Debug Options ---');
            console.log(`Function: ${analysisOptions.functionName}`);
            console.log(`Temperature: ${analysisOptions.temperature}`);
            console.log(`Max Tokens: ${analysisOptions.maxTokens}`);
            console.log(`Web Context: ${options.webContext}`);
            console.log(`Min Confidence: ${options.minConfidence}`);
            console.log(`Max Objects: ${options.maxObjects}`);
            console.log(`Annotation Color: ${options.annotationColor}`);
            console.log(`Save Annotations: ${!options.noAnnotations}`);
            console.log(`Save Image: ${options.saveImage}`);
            console.log(`System Instruction: ${analysisOptions.systemInstruction?.substring(0, 100)}...`);
        }
        progress.updateGlobal('Connecting to AI provider...');
        const result = await visionService.detectObjects(image, options.prompt || 'Detect all objects in this image', analysisOptions, options.provider);
        const processingTime = result.metadata?.processingTime || 0;
        let detectedObjects;
        try {
            detectedObjects = JSON.parse(result.text);
        }
        catch (parseError) {
            throw new Error(`Failed to parse detection results: ${parseError}`);
        }
        const filteredObjects = applyFilters(detectedObjects, {
            minConfidence: options.minConfidence,
            maxObjects: options.maxObjects,
        });
        let annotatedImagePath;
        if (options.saveImage && !options.noAnnotations) {
            try {
                progress.updateGlobal('Creating annotated image...');
                annotatedImagePath = await createAnnotatedImage(image, filteredObjects, options.annotationColor || 'red', options.saveImage);
            }
            catch (annotationError) {
                console.warn(`Warning: Failed to create annotated image: ${annotationError}`);
            }
        }
        const cliResult = {
            success: true,
            result: {
                image: image,
                prompt: options.prompt || 'Detect all objects in this image',
                provider: options.provider || 'google',
                model: result.metadata.model,
                detectedObjects: filteredObjects,
                objectCount: filteredObjects.length,
                annotationPath: annotatedImagePath,
                temperature: analysisOptions.temperature,
                maxTokens: analysisOptions.maxTokens,
                topP: analysisOptions.topP,
                topK: analysisOptions.topK,
                webContext: options.webContext,
                minConfidence: options.minConfidence,
                maxObjects: options.maxObjects,
                annotationColor: options.annotationColor,
                timestamp: new Date().toISOString(),
            },
            metadata: {
                executionTime: processingTime,
                timestamp: new Date().toISOString(),
                provider: result.metadata.provider,
                model: result.metadata.model,
            },
        };
        progress.succeedGlobal('Object detection completed');
        output.output(cliResult.result, 'Object Detection Results');
        if (options.save) {
            await saveResult(cliResult, options.save);
            console.log(`Results saved to: ${options.save}`);
        }
        if (annotatedImagePath) {
            console.log(`Annotated image saved to: ${annotatedImagePath}`);
        }
        if (options.verbose) {
            console.log('\n--- Debug Information ---');
            console.log(`Provider: ${result.metadata.provider}`);
            console.log(`Model: ${result.metadata.model}`);
            console.log(`Processing Time: ${processingTime}ms`);
            console.log(`Total Objects Detected: ${detectedObjects.length}`);
            console.log(`Filtered Objects: ${filteredObjects.length}`);
            if (result.metadata.usage) {
                console.log(`Prompt Tokens: ${result.metadata.usage.promptTokenCount}`);
                console.log(`Response Tokens: ${result.metadata.usage.candidatesTokenCount}`);
                console.log(`Total Tokens: ${result.metadata.usage.totalTokenCount}`);
            }
        }
    }
    catch (error) {
        progress.failGlobal('Object detection failed');
        (0, error_handler_js_1.handleError)(error instanceof Error ? error : new Error(String(error)), 'detect objects');
    }
    finally {
        progress.stopAll();
    }
});
function getDefaultSystemInstruction(webContext) {
    if (webContext) {
        return `
You are a visual detection assistant that names detected objects based on image context.

STEP 1 - DETECT CONTEXT:
Determine whether the image represents a webpage.

Consider it a webpage if you detect multiple web indicators such as:
- Browser UI (tabs, address bar, navigation buttons)
- Web-style layouts (menus, grids, form layouts)
- HTML controls (inputs, buttons, dropdowns)
- Web fonts or text rendering
- Visible URL or webpage content

STEP 2 - NAME ELEMENTS:
- If the image appears to be a webpage → use HTML element names
  (e.g., button, input, a, nav, header, section, h1-h6, p, img, video)
- Otherwise → use general object names based on visual meaning.

STEP 3 - OUTPUT FORMAT:
Return a valid JSON array (no text outside JSON) with bounding box coordinates.
`;
    }
    return `
You are an object detection assistant. Detect all visible objects in the image and provide their bounding box coordinates.

Return a valid JSON array with:
{
  "object": "<object category>",
  "label": "<description>",
  "normalized_box_2d": [ymin, xmin, ymax, xmax] // normalized to 0-1000
}

Bounding box rules:
- Tightly fit visible area (exclude shadows/whitespace)
- Avoid overlap when separable
- Maintain ymin < ymax and xmin < xmax
- Differentiate duplicates by traits (e.g., color, position)
`;
}
function createDetectionSchema(_provider) {
    return {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                object: {
                    type: 'string',
                    description: 'Generic category for detected object element.',
                },
                label: {
                    type: 'string',
                    description: 'Descriptive label or instance-specific detail.',
                },
                normalized_box_2d: {
                    type: 'array',
                    minItems: 4,
                    maxItems: 4,
                    items: {
                        type: 'integer',
                    },
                    description: 'Bounding box coordinates [ymin, xmin, ymax, xmax], normalized to 0-1000',
                },
            },
            required: ['object', 'label', 'normalized_box_2d'],
        },
    };
}
function applyFilters(objects, options) {
    let filtered = objects;
    if (options.maxObjects && options.maxObjects > 0) {
        filtered = filtered.slice(0, options.maxObjects);
    }
    return filtered;
}
async function createAnnotatedImage(imagePath, objects, color, outputPath) {
    try {
        let actualImagePath = imagePath;
        if (imagePath.startsWith('http')) {
            const response = await fetch(imagePath);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            actualImagePath = path_1.default.join(path_1.default.dirname(outputPath), `temp_${Date.now()}.jpg`);
            await promises_1.default.writeFile(actualImagePath, buffer);
        }
        const annotator = new imageAnnotator_js_1.ImageAnnotator({
            color,
            lineWidth: 3,
            fontSize: 16,
            showLabels: true,
            showConfidence: false,
            labelBackground: true,
        });
        await annotator.createAnnotatedImage(actualImagePath, objects, outputPath);
        if (actualImagePath !== imagePath && imagePath.startsWith('http')) {
            try {
                await promises_1.default.unlink(actualImagePath);
            }
            catch (cleanupError) {
            }
        }
        return outputPath;
    }
    catch (error) {
        throw new Error(`Failed to create annotated image: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function saveResult(data, filePath) {
    const dir = path_1.default.dirname(filePath);
    await promises_1.default.mkdir(dir, { recursive: true });
    const content = JSON.stringify(data, null, 2);
    await promises_1.default.writeFile(filePath, content, 'utf-8');
}
exports.detectCommand.addCommand(exports.detectObjectsCommand);
//# sourceMappingURL=detect.js.map
import { Command } from 'commander';
import { VisionService } from '../services/VisionService.js';
import { OutputFormatter } from '../utils/output-formatter.js';
import { ProgressManager } from '../utils/progress.js';
import { handleError } from '../utils/error-handler.js';
import { CLIAnalysisResult } from '../types/index.js';
import { ImageAnnotator } from '../utils/imageAnnotator.js';
import fs from 'fs/promises';
import path from 'path';

export const detectCommand = new Command('detect')
  .description('Detect objects in images with AI-powered analysis');

// Object detection subcommand
export const detectObjectsCommand = new Command('objects')
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
    const progress = new ProgressManager(options.noProgress);
    const output = new OutputFormatter({
      format: options.output || 'json',
      pretty: true,
      colors: true
    });

    try {
      progress.startGlobal('Detecting objects');

      // Initialize vision service
      const visionService = VisionService.getInstance();

      const analysisOptions = {
        functionName: 'detect_objects_in_image' as const,
        temperature: options.temperature || 0, // Use low temperature for deterministic detection
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

      // Perform object detection
      const result = await visionService.detectObjects(
        image,
        options.prompt || 'Detect all objects in this image',
        analysisOptions,
        options.provider
      );

      const processingTime = result.metadata?.processingTime || 0;

      // Parse detection results
      let detectedObjects;
      try {
        detectedObjects = JSON.parse(result.text);
      } catch (parseError) {
        throw new Error(`Failed to parse detection results: ${parseError}`);
      }

      // Apply confidence and max objects filters
      const filteredObjects = applyFilters(detectedObjects, {
        minConfidence: options.minConfidence,
        maxObjects: options.maxObjects,
      });

      // Create annotated image if requested
      let annotatedImagePath: string | undefined;
      if (options.saveImage && !options.noAnnotations) {
        try {
          progress.updateGlobal('Creating annotated image...');
          annotatedImagePath = await createAnnotatedImage(
            image,
            filteredObjects,
            options.annotationColor || 'red',
            options.saveImage
          );
        } catch (annotationError) {
          console.warn(`Warning: Failed to create annotated image: ${annotationError}`);
        }
      }

      // Create CLI result
      const cliResult: CLIAnalysisResult = {
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

      // Show additional info if verbose
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

    } catch (error) {
      progress.failGlobal('Object detection failed');
      handleError(error instanceof Error ? error : new Error(String(error)), 'detect objects');
    } finally {
      progress.stopAll();
    }
  });

// Helper functions

function getDefaultSystemInstruction(webContext: boolean): string {
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

function createDetectionSchema(_provider: string): any {
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

interface FilterOptions {
  minConfidence?: number;
  maxObjects?: number;
}

function applyFilters(objects: any[], options: FilterOptions): any[] {
  let filtered = objects;

  // Apply max objects limit
  if (options.maxObjects && options.maxObjects > 0) {
    filtered = filtered.slice(0, options.maxObjects);
  }

  // Note: The current schema doesn't include confidence scores
  // This would need to be enhanced if the provider supports confidence values

  return filtered;
}

async function createAnnotatedImage(
  imagePath: string,
  objects: any[],
  color: string,
  outputPath: string
): Promise<string> {
  try {
    // Download image if it's a URL
    let actualImagePath = imagePath;
    if (imagePath.startsWith('http')) {
      const response = await fetch(imagePath);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save to temporary file
      actualImagePath = path.join(path.dirname(outputPath), `temp_${Date.now()}.jpg`);
      await fs.writeFile(actualImagePath, buffer);
    }

    // Create annotator instance
    const annotator = new ImageAnnotator({
      color,
      lineWidth: 3,
      fontSize: 16,
      showLabels: true,
      showConfidence: false,
      labelBackground: true,
    });

    // Create annotated image
    await annotator.createAnnotatedImage(
      actualImagePath,
      objects,
      outputPath
    );

    // Clean up temporary file if created
    if (actualImagePath !== imagePath && imagePath.startsWith('http')) {
      try {
        await fs.unlink(actualImagePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    return outputPath;
  } catch (error) {
      throw new Error(`Failed to create annotated image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveResult(data: unknown, filePath: string): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Save as JSON
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

// Add subcommand to parent
detectCommand.addCommand(detectObjectsCommand);
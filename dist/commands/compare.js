"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareCommand = void 0;
const commander_1 = require("commander");
const VisionService_js_1 = require("../services/VisionService.js");
const output_formatter_js_1 = require("../utils/output-formatter.js");
const progress_js_1 = require("../utils/progress.js");
const error_handler_js_1 = require("../utils/error-handler.js");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
exports.compareCommand = new commander_1.Command('compare')
    .description('Compare multiple images')
    .argument('[images...]', 'Image file paths or URLs (2-4 images)')
    .option('-p, --prompt <prompt>', 'Comparison prompt', 'Compare these images and highlight their similarities and differences')
    .option('-o, --output <format>', 'Output format (json|text|table)', 'json')
    .option('-s, --save <path>', 'Save output to file')
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
    .action(async (images, options) => {
    const progress = new progress_js_1.ProgressManager(options.noProgress);
    const output = new output_formatter_js_1.OutputFormatter({
        format: options.output || 'json',
        pretty: true,
        colors: true
    });
    try {
        if (!images || images.length < 2) {
            throw new Error('At least 2 images are required for comparison');
        }
        if (images.length > 4) {
            throw new Error('Maximum 4 images can be compared at once');
        }
        progress.startGlobal('Comparing images');
        const visionService = VisionService_js_1.VisionService.getInstance();
        const analysisOptions = {
            functionName: 'compare_images',
            temperature: options.temperature || 0.2,
            maxTokens: options.maxTokens || 4096,
            topP: options.topP,
            topK: options.topK,
            systemInstruction: options.systemInstruction || getComparisonSystemInstruction(),
            enableFileUpload: options.forceUpload,
            filesThreshold: options.filesThreshold,
            includeMetadata: true,
            debugMode: options.verbose || process.env.LOG_LEVEL === 'debug',
        };
        if (options.verbose) {
            console.log('\n--- Debug Options ---');
            console.log(`Function: ${analysisOptions.functionName}`);
            console.log(`Images: ${images.length}`);
            console.log(`Temperature: ${analysisOptions.temperature}`);
            console.log(`Max Tokens: ${analysisOptions.maxTokens}`);
            console.log(`System Instruction: ${analysisOptions.systemInstruction?.substring(0, 100)}...`);
            console.log('Image Sources:');
            images.forEach((img, idx) => console.log(`  ${idx + 1}. ${img}`));
        }
        progress.updateGlobal('Processing images...');
        const result = await visionService.compareImages(images, options.prompt || 'Compare these images and highlight their similarities and differences', analysisOptions, options.provider);
        const processingTime = result.metadata?.processingTime || 0;
        const cliResult = {
            success: true,
            result: {
                images: images,
                prompt: options.prompt || 'Compare these images and highlight their similarities and differences',
                provider: options.provider || 'google',
                model: result.metadata.model,
                comparison: result.text,
                imageCount: images.length,
                temperature: analysisOptions.temperature,
                maxTokens: analysisOptions.maxTokens,
                topP: analysisOptions.topP,
                topK: analysisOptions.topK,
                timestamp: new Date().toISOString(),
            },
            metadata: {
                executionTime: processingTime,
                timestamp: new Date().toISOString(),
                provider: result.metadata.provider,
                model: result.metadata.model,
            },
        };
        progress.succeedGlobal('Image comparison completed');
        output.output(cliResult.result, 'Image Comparison Results');
        if (options.save) {
            await saveResult(cliResult, options.save);
            console.log(`Results saved to: ${options.save}`);
        }
        if (options.verbose) {
            console.log('\n--- Debug Information ---');
            console.log(`Provider: ${result.metadata.provider}`);
            console.log(`Model: ${result.metadata.model}`);
            console.log(`Processing Time: ${processingTime}ms`);
            console.log(`Images Processed: ${images.length}`);
            if (result.metadata.usage) {
                console.log(`Prompt Tokens: ${result.metadata.usage.promptTokenCount}`);
                console.log(`Response Tokens: ${result.metadata.usage.candidatesTokenCount}`);
                console.log(`Total Tokens: ${result.metadata.usage.totalTokenCount}`);
            }
        }
    }
    catch (error) {
        progress.failGlobal('Image comparison failed');
        (0, error_handler_js_1.handleError)(error instanceof Error ? error : new Error(String(error)), 'compare images');
    }
    finally {
        progress.stopAll();
    }
});
function getComparisonSystemInstruction() {
    return `
You are an expert image analysis assistant specializing in comparing multiple images.

When comparing images, provide:
1. **Similarities**: What the images have in common (subjects, style, composition, colors, themes)
2. **Differences**: What makes each image unique (content, style, quality, perspective)
3. **Overall Assessment**: A summary of the relationship between the images
4. **Technical Details**: When relevant, note technical aspects like lighting, focus, composition

Format your response as clear, structured text that helps the user understand both the obvious and subtle relationships between the images.

Consider:
- Visual elements (colors, shapes, composition)
- Content and subject matter
- Style and artistic choices
- Technical quality and execution
- Context and purpose
- Emotional impact or mood
`;
}
async function saveResult(data, filePath) {
    const dir = path_1.default.dirname(filePath);
    await promises_1.default.mkdir(dir, { recursive: true });
    const content = JSON.stringify(data, null, 2);
    await promises_1.default.writeFile(filePath, content, 'utf-8');
}
//# sourceMappingURL=compare.js.map
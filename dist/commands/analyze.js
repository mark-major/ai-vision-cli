"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeImageCommand = exports.analyzeCommand = void 0;
const commander_1 = require("commander");
const VisionService_js_1 = require("../services/VisionService.js");
const output_formatter_js_1 = require("../utils/output-formatter.js");
const progress_js_1 = require("../utils/progress.js");
const error_handler_js_1 = require("../utils/error-handler.js");
exports.analyzeCommand = new commander_1.Command('analyze')
    .description('Analyze images');
exports.analyzeImageCommand = new commander_1.Command('image')
    .description('Analyze a single image')
    .argument('<image>', 'Image file path or URL')
    .option('-p, --prompt <prompt>', 'Analysis prompt', 'Analyze this image')
    .option('-o, --output <format>', 'Output format (json|text|table)', 'json')
    .option('-s, --save <path>', 'Save output to file')
    .option('-t, --temperature <temp>', 'AI temperature (0-1)', parseFloat)
    .option('--max-tokens <tokens>', 'Maximum output tokens', parseInt)
    .option('--top-p <value>', 'Top P value (0-1)', parseFloat)
    .option('--top-k <value>', 'Top K value (1-100)', parseInt)
    .option('--stop-sequences <sequences>', 'Stop sequences (comma-separated)')
    .option('--system-instruction <instruction>', 'System instruction to guide model behavior')
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
        progress.startGlobal('Analyzing image');
        const visionService = VisionService_js_1.VisionService.getInstance();
        const stopSequences = options.stopSequences
            ? options.stopSequences.split(',').map((s) => s.trim())
            : undefined;
        const analysisOptions = {
            functionName: 'analyze_image',
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            topK: options.topK,
            stopSequences,
            systemInstruction: options.systemInstruction,
            enableFileUpload: options.forceUpload,
            filesThreshold: options.filesThreshold,
            includeMetadata: true,
            debugMode: options.verbose || process.env.LOG_LEVEL === 'debug',
        };
        if (options.verbose) {
            console.log('\n--- Debug Options ---');
            console.log(`Function: ${analysisOptions.functionName}`);
            console.log(`Temperature: ${analysisOptions.temperature}`);
            console.log(`Max Tokens: ${analysisOptions.maxTokens}`);
            console.log(`Top P: ${analysisOptions.topP}`);
            console.log(`Top K: ${analysisOptions.topK}`);
            console.log(`Stop Sequences: ${analysisOptions.stopSequences}`);
            console.log(`System Instruction: ${analysisOptions.systemInstruction}`);
            console.log(`Force Upload: ${analysisOptions.enableFileUpload}`);
            console.log(`Files Threshold: ${analysisOptions.filesThreshold}`);
        }
        progress.updateGlobal('Connecting to AI provider...');
        const result = await visionService.analyzeImage(image, options.prompt || 'Analyze this image', analysisOptions, options.provider);
        const processingTime = result.metadata?.processingTime || 0;
        const cliResult = {
            success: true,
            result: {
                image: image,
                analysis: result.text,
                prompt: options.prompt || 'Analyze this image',
                provider: options.provider || 'google',
                model: result.metadata.model,
                temperature: analysisOptions.temperature,
                maxTokens: analysisOptions.maxTokens,
                topP: analysisOptions.topP,
                topK: analysisOptions.topK,
                stopSequences: analysisOptions.stopSequences,
                systemInstruction: analysisOptions.systemInstruction,
                timestamp: new Date().toISOString(),
            },
            metadata: {
                executionTime: processingTime,
                timestamp: new Date().toISOString(),
                provider: result.metadata.provider,
                model: result.metadata.model,
            },
        };
        if (result.metadata.usage) {
            cliResult.result.usage = result.metadata.usage;
            cliResult.result.tokens = {
                prompt: result.metadata.usage.promptTokenCount,
                candidates: result.metadata.usage.candidatesTokenCount,
                total: result.metadata.usage.totalTokenCount,
            };
        }
        progress.succeedGlobal('Image analysis completed');
        output.output(cliResult.result, 'Image Analysis Results');
        if (options.save) {
            await saveResult(cliResult, options.save);
            console.log(`Results saved to: ${options.save}`);
        }
        if (options.verbose) {
            console.log('\n--- Debug Information ---');
            console.log(`Provider: ${result.metadata.provider}`);
            console.log(`Model: ${result.metadata.model}`);
            console.log(`Processing Time: ${processingTime}ms`);
            if (result.metadata.usage) {
                console.log(`Prompt Tokens: ${result.metadata.usage.promptTokenCount}`);
                console.log(`Response Tokens: ${result.metadata.usage.candidatesTokenCount}`);
                console.log(`Total Tokens: ${result.metadata.usage.totalTokenCount}`);
            }
        }
    }
    catch (error) {
        progress.failGlobal('Image analysis failed');
        (0, error_handler_js_1.handleError)(error instanceof Error ? error : new Error(String(error)), 'analyze image');
    }
    finally {
        progress.stopAll();
    }
});
async function saveResult(data, filePath) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs'))).then(m => m.promises);
    const path = await Promise.resolve().then(() => __importStar(require('path')));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
}
exports.analyzeCommand.addCommand(exports.analyzeImageCommand);
//# sourceMappingURL=analyze.js.map
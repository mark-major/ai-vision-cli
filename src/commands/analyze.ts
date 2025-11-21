import { Command } from 'commander';
import { VisionService } from '../services/VisionService.js';
import { OutputFormatter } from '../utils/output-formatter.js';
import { ProgressManager } from '../utils/progress.js';
import { handleError } from '../utils/error-handler.js';
import { CLIAnalysisResult } from '../types/index.js';

export const analyzeCommand = new Command('analyze')
  .description('Analyze images');

export const analyzeImageCommand = new Command('image')
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
    const progress = new ProgressManager(options.noProgress);
    const output = new OutputFormatter({
      format: options.output || 'json',
      pretty: true,
      colors: true
    });

    try {
      progress.startGlobal('Analyzing image');

      const visionService = VisionService.getInstance();

      const stopSequences = options.stopSequences
        ? options.stopSequences.split(',').map((s: string) => s.trim())
        : undefined;

      const analysisOptions = {
        functionName: 'analyze_image' as const,
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

      const result = await visionService.analyzeImage(
        image,
        options.prompt || 'Analyze this image',
        analysisOptions,
        options.provider
      );

      const processingTime = result.metadata?.processingTime || 0;

      const cliResult: CLIAnalysisResult = {
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

      // Show additional info if verbose
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

    } catch (error) {
      progress.failGlobal('Image analysis failed');
      handleError(error instanceof Error ? error : new Error(String(error)), 'analyze image');
    } finally {
      progress.stopAll();
    }
  });

async function saveResult(data: unknown, filePath: string): Promise<void> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

analyzeCommand.addCommand(analyzeImageCommand);
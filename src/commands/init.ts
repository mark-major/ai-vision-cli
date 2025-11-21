import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigService } from '../config/ConfigService.js';
import { ProgressManager } from '../utils/progress.js';
import { OutputFormatter } from '../utils/output-formatter.js';

export const initCommand = new Command('init')
  .description('Initialize AI Vision CLI configuration')
  .option('-p, --provider <provider>', 'AI provider to use (google|vertex_ai)')
  .option('-i, --interactive', 'Run interactive setup', true)
  .option('-c, --config <path>', 'Custom config file path')
  .option('--defaults', 'Use default configuration without prompts', false)
  .action(async (options) => {
    const progress = new ProgressManager();
    const output = new OutputFormatter({ format: 'text' });

    try {
      progress.startGlobal('Initializing AI Vision CLI');

      const configService = ConfigService.getInstance();

      // Set custom config path if provided
      if (options.config) {
        configService.setConfigPath(options.config);
      }

      let config;

      if (options.defaults) {
        // Use default configuration
        config = await createDefaultConfig(configService, options.provider);
        await configService.saveConfig(config);

        output.success('Configuration created successfully with defaults');
        output.info(`Config file: ${configService.getConfigPath()}`);

      } else if (options.interactive) {
        // Interactive setup
        config = await runInteractiveSetup(configService, progress, options.provider);
        await configService.saveConfig(config);

        output.success('Configuration created successfully!');
        output.info(`Config file: ${configService.getConfigPath()}`);

      } else {
        // Simple provider selection
        config = await createSimpleConfig(configService, options.provider);
        await configService.saveConfig(config);

        output.success('Configuration created successfully!');
      }

      // Test the configuration
      progress.updateGlobal('Testing configuration...');
      await testConfiguration(config);

      progress.succeedGlobal('AI Vision CLI is ready to use!');

      output.info('\nNext steps:');
      output.info('  Try: ai-vision analyze image <image-path>');
      output.info('  Try: ai-vision detect objects <image-path>');
      
    } catch (error) {
      progress.failGlobal('Initialization failed');
      output.error('Failed to initialize configuration', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

async function createDefaultConfig(
  configService: ConfigService,
  provider?: string
): Promise<any> {
  const config = await configService.loadConfig();

  if (provider) {
    config.providers.image = provider as 'google' | 'vertex_ai';
  }

  // Check for environment variables and use them
  if (process.env.GEMINI_API_KEY) {
    config.credentials.gemini_api_key = process.env.GEMINI_API_KEY;
  }

  if (process.env.VERTEX_CREDENTIALS) {
    config.credentials.vertex_credentials = process.env.VERTEX_CREDENTIALS;
  }

  if (process.env.GCS_BUCKET_NAME) {
    config.credentials.gcs_bucket_name = process.env.GCS_BUCKET_NAME;
  }

  return config;
}

async function createSimpleConfig(
  configService: ConfigService,
  provider?: string
): Promise<any> {
  const config = await configService.loadConfig();

  if (provider) {
    config.providers.image = provider as 'google' | 'vertex_ai';
  } else if (!process.env.IMAGE_PROVIDER) {
    // Ask for provider if not specified
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Which AI provider would you like to use?',
        choices: [
          {
            name: 'Google Gemini API (Recommended for development)',
            value: 'google'
          },
          {
            name: 'Google Vertex AI (Enterprise features)',
            value: 'vertex_ai'
          }
        ],
        default: 'google'
      }
    ]);

    config.providers.image = answers.provider;
      }

  return config;
}

async function runInteractiveSetup(
  configService: ConfigService,
  _progress: ProgressManager,
  provider?: string
): Promise<any> {
  const config = await configService.loadConfig();

  console.log(chalk.blue.bold('\n🚀 AI Vision CLI Interactive Setup\n'));

  // Provider selection
  const providerAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider would you like to use?',
      choices: [
        {
          name: 'Google Gemini API (Recommended for development)',
          value: 'google'
        },
        {
          name: 'Google Vertex AI (Enterprise features)',
          value: 'vertex_ai'
        }
      ],
      default: provider || 'google'
    }
  ]);

  config.providers.image = providerAnswers.provider;
  
  // AI Model Settings
  const modelAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'imageModel',
      message: 'Select image analysis model:',
      choices: [
        { name: 'gemini-2.0-flash-exp (Fast, versatile)', value: 'gemini-2.0-flash-exp' },
        { name: 'gemini-1.5-flash (Fast)', value: 'gemini-1.5-flash' },
        { name: 'gemini-1.5-pro (High quality)', value: 'gemini-1.5-pro' }
      ],
      default: 'gemini-2.0-flash-exp'
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'AI creativity level (0.0-1.0):',
      default: 0.4,
      validate: (input) => input >= 0 && input <= 1 || 'Must be between 0 and 1'
    }
  ]);

  config.settings.image_model = modelAnswers.imageModel;
  config.settings.temperature = modelAnswers.temperature;

  // Output preferences
  const outputAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'outputFormat',
      message: 'Default output format:',
      choices: [
        { name: 'JSON (Structured data)', value: 'json' },
        { name: 'Table (Human readable)', value: 'table' },
        { name: 'Text (Plain text)', value: 'text' }
      ],
      default: 'json'
    },
    {
      type: 'confirm',
      name: 'progressBars',
      message: 'Show progress indicators?',
      default: true
    }
  ]);

  config.settings.output_format = outputAnswers.outputFormat;
  config.settings.progress_bars = outputAnswers.progressBars;

  // Check for existing credentials
  console.log(chalk.yellow('\n📋 Checking for credentials...'));

  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasVertexCreds = !!process.env.VERTEX_CREDENTIALS;
  const hasGCSBucket = !!process.env.GCS_BUCKET_NAME;

  if (providerAnswers.provider === 'google' && !hasGeminiKey) {
    console.log(chalk.yellow('⚠️  No GEMINI_API_KEY found in environment variables.'));
    console.log(chalk.gray('   You can set it later with: export GEMINI_API_KEY=your-key'));
  }

  if (providerAnswers.provider === 'vertex_ai' && (!hasVertexCreds || !hasGCSBucket)) {
    console.log(chalk.yellow('⚠️  Vertex AI requires additional setup:'));
    if (!hasVertexCreds) {
      console.log(chalk.gray('   - VERTEX_CREDENTIALS: Path to service account JSON file'));
    }
    if (!hasGCSBucket) {
      console.log(chalk.gray('   - GCS_BUCKET_NAME: Google Cloud Storage bucket name'));
    }
  }

  if (hasGeminiKey || hasVertexCreds) {
    console.log(chalk.green('✅ Found credentials in environment variables'));
  }

  return config;
}

async function testConfiguration(config: any): Promise<void> {
  // Basic validation of configuration
  const requiredFields = ['providers', 'settings', 'limits', 'formats'];

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required configuration field: ${field}`);
    }
  }

  // Validate provider settings
  if (!['google', 'vertex_ai'].includes(config.providers.image)) {
    throw new Error(`Invalid image provider: ${config.providers.image}`);
  }

  // Validate credentials for selected providers
  if (config.providers.image === 'google' && !process.env.GEMINI_API_KEY) {
    console.log(chalk.yellow('⚠️  GEMINI_API_KEY not found in environment variables'));
  }

  if (config.providers.image === 'vertex_ai') {
    if (!process.env.VERTEX_CREDENTIALS) {
      console.log(chalk.yellow('⚠️  VERTEX_CREDENTIALS not found in environment variables'));
    }
    if (!process.env.GCS_BUCKET_NAME) {
      console.log(chalk.yellow('⚠️  GCS_BUCKET_NAME not found in environment variables'));
    }
  }
}
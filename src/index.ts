#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { analyzeCommand } from './commands/analyze.js';
import { compareCommand } from './commands/compare.js';
import { detectCommand } from './commands/detect.js';
import { configCommand } from './commands/config.js';
import { handleError } from './utils/error-handler.js';

const program = new Command();

program
  .name('ai-vision')
  .description('Enterprise-grade AI-powered image analysis CLI with advanced reliability features')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--config <path>', 'Path to config file', '~/.ai-vision/config.yaml')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
    if (options.quiet) {
      process.env.LOG_LEVEL = 'error';
    }
  });

program.addCommand(initCommand);
program.addCommand(analyzeCommand);
program.addCommand(compareCommand);
program.addCommand(detectCommand);
program.addCommand(configCommand);

program.exitOverride((err) => {
  handleError(err);
  process.exit(1);
});

program.parse();
if (!process.argv.slice(2).length) {
  console.log(chalk.blue('AI Vision CLI - Enterprise-grade AI image analysis'));
  console.log('');
  console.log('Usage: ai-vision <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  init           Initialize configuration');
  console.log('  analyze image  Analyze a single image');
  console.log('  compare images Compare multiple images');
  console.log('  detect objects Detect objects in an image');
  console.log('  config         Manage configuration');
  console.log('');
  console.log('Features:');
  console.log('  • Advanced error handling with intelligent retry logic');
  console.log('  • Circuit breaker pattern for provider failures');
  console.log('  • Rate limiting and quota management');
  console.log('  • Health monitoring and connectivity checks');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help     Show help');
  console.log('  -v, --version  Show version number');
  console.log('');
  console.log('Run "ai-vision <command> --help" for more information on a specific command.');
}
#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const init_js_1 = require("./commands/init.js");
const analyze_js_1 = require("./commands/analyze.js");
const compare_js_1 = require("./commands/compare.js");
const detect_js_1 = require("./commands/detect.js");
const config_js_1 = require("./commands/config.js");
const error_handler_js_1 = require("./utils/error-handler.js");
const program = new commander_1.Command();
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
program.addCommand(init_js_1.initCommand);
program.addCommand(analyze_js_1.analyzeCommand);
program.addCommand(compare_js_1.compareCommand);
program.addCommand(detect_js_1.detectCommand);
program.addCommand(config_js_1.configCommand);
program.exitOverride((err) => {
    (0, error_handler_js_1.handleError)(err);
    process.exit(1);
});
program.parse();
if (!process.argv.slice(2).length) {
    console.log(chalk_1.default.blue('AI Vision CLI - Enterprise-grade AI image analysis'));
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
//# sourceMappingURL=index.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configTestCommand = exports.configListCommand = exports.configSetCommand = exports.configGetCommand = exports.configCommand = void 0;
const commander_1 = require("commander");
exports.configCommand = new commander_1.Command('config')
    .description('Manage AI Vision CLI configuration');
exports.configGetCommand = new commander_1.Command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action(async (key) => {
    console.log(`Getting config value for: ${key}`);
    console.log('This command will be implemented in the next phase.');
});
exports.configSetCommand = new commander_1.Command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action(async (key, value) => {
    console.log(`Setting config value: ${key} = ${value}`);
    console.log('This command will be implemented in the next phase.');
});
exports.configListCommand = new commander_1.Command('list')
    .description('List all configuration values')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .action(async (options) => {
    console.log('Listing all configuration values');
    console.log('Options:', options);
    console.log('This command will be implemented in the next phase.');
});
exports.configTestCommand = new commander_1.Command('test')
    .description('Test configuration and provider connections')
    .option('--provider <provider>', 'Test specific provider (google|vertex_ai)')
    .action(async (options) => {
    console.log('Testing configuration');
    console.log('Options:', options);
    console.log('This command will be implemented in the next phase.');
});
exports.configCommand.addCommand(exports.configGetCommand);
exports.configCommand.addCommand(exports.configSetCommand);
exports.configCommand.addCommand(exports.configListCommand);
exports.configCommand.addCommand(exports.configTestCommand);
//# sourceMappingURL=config.js.map
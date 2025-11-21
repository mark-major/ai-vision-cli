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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputFormatter = void 0;
exports.createOutputFormatter = createOutputFormatter;
exports.displayResults = displayResults;
exports.saveOutput = saveOutput;
exports.convertToCSV = convertToCSV;
const chalk_1 = __importDefault(require("chalk"));
class SimpleTable {
    data = [];
    headers = [];
    constructor(options) {
        if (options?.head) {
            this.headers = options.head;
        }
    }
    push(row) {
        this.data.push(row);
    }
    toString() {
        const allRows = [this.headers, ...this.data];
        if (allRows.length === 0)
            return '';
        const colCount = Math.max(...allRows.map(row => row.length));
        const colWidths = Array(colCount).fill(0);
        for (const row of allRows) {
            for (let i = 0; i < row.length; i++) {
                colWidths[i] = Math.max(colWidths[i], row[i].length);
            }
        }
        const lines = [];
        if (this.headers.length > 0) {
            const headerRow = this.headers.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
            lines.push(headerRow);
            lines.push(colWidths.map(width => '-'.repeat(width)).join('-|-'));
        }
        for (const row of this.data) {
            const formattedRow = row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
            lines.push(formattedRow);
        }
        return lines.join('\n');
    }
}
class OutputFormatter {
    options;
    colors;
    constructor(options = { format: 'json' }) {
        this.options = { ...options };
        this.colors = this.options.colors !== false && !process.env.NO_COLOR;
    }
    output(data, title) {
        if (this.options.raw) {
            console.log(data);
            return;
        }
        if (title) {
            console.log(chalk_1.default.bold(title));
        }
        switch (this.options.format) {
            case 'json':
                this.outputJson(data);
                break;
            case 'table':
                this.outputTable(data);
                break;
            case 'text':
                this.outputText(data);
                break;
            default:
                this.outputJson(data);
        }
        if (title) {
            console.log('');
        }
    }
    outputJson(data) {
        const jsonString = this.options.pretty
            ? JSON.stringify(data, null, 2)
            : JSON.stringify(data);
        if (this.colors && this.options.pretty) {
            const highlighted = jsonString
                .replace(/"([^"]+)":/g, chalk_1.default.cyan('"$1":'))
                .replace(/: "([^"]+)"/g, `: ${chalk_1.default.green('"$1"')}`)
                .replace(/: (\d+)/g, `: ${chalk_1.default.yellow('$1')}`)
                .replace(/: (true|false)/g, `: ${chalk_1.default.blue('$1')}`);
            console.log(highlighted);
        }
        else {
            console.log(jsonString);
        }
    }
    outputTable(data) {
        if (!this.isTabular(data)) {
            console.log(chalk_1.default.yellow('Data is not suitable for table format, falling back to JSON:'));
            this.outputJson(data);
            return;
        }
        const table = this.createTable(data);
        console.log(table.toString());
    }
    outputText(data) {
        const text = this.formatAsText(data);
        console.log(text);
    }
    createTable(data) {
        if (Array.isArray(data) && data.length > 0) {
            return this.createTableFromArray(data);
        }
        else if (typeof data === 'object' && data !== null) {
            return this.createTableFromObject(data);
        }
        else {
            const table = new SimpleTable();
            table.push([this.formatValue(data), '']);
            return table;
        }
    }
    createTableFromArray(array) {
        const table = new SimpleTable({
            head: this.extractHeaders(array[0]),
        });
        for (const item of array) {
            if (typeof item === 'object' && item !== null) {
                const row = Object.values(item).map(value => this.formatValue(value));
                table.push(row);
            }
            else {
                table.push([this.formatValue(item)]);
            }
        }
        return table;
    }
    createTableFromObject(obj) {
        const table = new SimpleTable({
            head: ['Property', 'Value'],
        });
        for (const [key, value] of Object.entries(obj)) {
            table.push([key, this.formatValue(value)]);
        }
        return table;
    }
    extractHeaders(item) {
        if (typeof item === 'object' && item !== null) {
            return Object.keys(item);
        }
        return ['Value'];
    }
    formatValue(value) {
        if (value === null || value === undefined) {
            return this.colors ? chalk_1.default.gray('null') : 'null';
        }
        if (typeof value === 'string') {
            return this.colors ? chalk_1.default.green(value) : value;
        }
        if (typeof value === 'number') {
            return this.colors ? chalk_1.default.yellow(value.toString()) : value.toString();
        }
        if (typeof value === 'boolean') {
            return this.colors ? chalk_1.default.blue(value.toString()) : value.toString();
        }
        if (typeof value === 'object') {
            const objValue = value;
            return this.options.pretty ? JSON.stringify(objValue, null, 2) : JSON.stringify(objValue);
        }
        return String(value);
    }
    formatAsText(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.formatAsText(item)).join('\n');
        }
        if (typeof data === 'object' && data !== null) {
            return Object.entries(data)
                .map(([key, value]) => `${key}: ${this.formatValue(value)}`)
                .join('\n');
        }
        return this.formatValue(data);
    }
    isTabular(data) {
        if (Array.isArray(data)) {
            return data.length > 0 && data.every(item => typeof item === 'object' && item !== null);
        }
        if (typeof data === 'object' && data !== null) {
            return Object.keys(data).length > 0;
        }
        return false;
    }
    success(message, details) {
        const successMsg = this.colors ? chalk_1.default.green('✓') : '✓';
        console.log(`${successMsg} ${message}`);
        if (details) {
            this.output(details);
        }
    }
    error(message, details) {
        const errorMsg = this.colors ? chalk_1.default.red('✗') : '✗';
        console.error(`${errorMsg} ${message}`);
        if (details) {
            this.output(details);
        }
    }
    warning(message, details) {
        const warningMsg = this.colors ? chalk_1.default.yellow('⚠') : '⚠';
        console.warn(`${warningMsg} ${message}`);
        if (details) {
            this.output(details);
        }
    }
    info(message, details) {
        const infoMsg = this.colors ? chalk_1.default.blue('ℹ') : 'ℹ';
        console.log(`${infoMsg} ${message}`);
        if (details) {
            this.output(details);
        }
    }
}
exports.OutputFormatter = OutputFormatter;
function createOutputFormatter(format, pretty = true, colors = true) {
    const outputFormat = format === 'text' ? 'text' : format === 'table' ? 'table' : 'json';
    return new OutputFormatter({
        format: outputFormat,
        pretty,
        colors,
    });
}
function displayResults(data, title, format, pretty = true) {
    const formatter = createOutputFormatter(format, pretty);
    formatter.output(data, title);
}
async function saveOutput(data, filePath, format = 'json') {
    const { promises: fs } = await Promise.resolve().then(() => __importStar(require('fs')));
    const { dirname } = await Promise.resolve().then(() => __importStar(require('path')));
    await fs.mkdir(dirname(filePath), { recursive: true });
    let content;
    switch (format) {
        case 'json':
            content = JSON.stringify(data, null, 2);
            break;
        case 'text':
            content = String(data);
            break;
        case 'csv':
            content = convertToCSV(data);
            break;
        default:
            content = JSON.stringify(data, null, 2);
    }
    await fs.writeFile(filePath, content, 'utf-8');
}
function convertToCSV(data) {
    if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined)
                    return '';
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return String(value);
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }
    return '';
}
//# sourceMappingURL=output-formatter.js.map
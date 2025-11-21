import chalk from 'chalk';

// Simple table class for basic table output
class SimpleTable {
  private data: string[][] = [];
  private headers: string[] = [];

  constructor(options?: { head?: string[] }) {
    if (options?.head) {
      this.headers = options.head;
    }
  }

  push(row: string[]): void {
    this.data.push(row);
  }

  toString(): string {
    const allRows = [this.headers, ...this.data];
    if (allRows.length === 0) return '';

    // Calculate column widths
    const colCount = Math.max(...allRows.map(row => row.length));
    const colWidths = Array(colCount).fill(0);

    for (const row of allRows) {
      for (let i = 0; i < row.length; i++) {
        colWidths[i] = Math.max(colWidths[i], row[i].length);
      }
    }

    // Build table string
    const lines: string[] = [];

    // Header separator
    if (this.headers.length > 0) {
      const headerRow = this.headers.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
      lines.push(headerRow);
      lines.push(colWidths.map(width => '-'.repeat(width)).join('-|-'));
    }

    // Data rows
    for (const row of this.data) {
      const formattedRow = row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
      lines.push(formattedRow);
    }

    return lines.join('\n');
  }
}

export interface OutputOptions {
  format: 'json' | 'text' | 'table';
  pretty?: boolean;
  colors?: boolean;
  raw?: boolean; // Skip formatting for scripts
}

export class OutputFormatter {
  private options: OutputOptions;
  private colors: boolean;

  constructor(options: OutputOptions = { format: 'json' }) {
    this.options = { ...options };
    this.colors = this.options.colors !== false && !process.env.NO_COLOR;
  }

  /**
   * Format and output data to console
   */
  public output(data: unknown, title?: string): void {
    if (this.options.raw) {
      console.log(data);
      return;
    }

    if (title) {
      console.log(chalk.bold(title));
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
      console.log(''); // Add blank line after title
    }
  }

  /**
   * Format data as JSON
   */
  private outputJson(data: unknown): void {
    const jsonString = this.options.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    if (this.colors && this.options.pretty) {
      // Add syntax highlighting for JSON (simple version)
      const highlighted = jsonString
        .replace(/"([^"]+)":/g, chalk.cyan('"$1":')) // Keys
        .replace(/: "([^"]+)"/g, `: ${chalk.green('"$1"')}`) // String values
        .replace(/: (\d+)/g, `: ${chalk.yellow('$1')}`) // Numbers
        .replace(/: (true|false)/g, `: ${chalk.blue('$1')}`); // Booleans

      console.log(highlighted);
    } else {
      console.log(jsonString);
    }
  }

  /**
   * Format data as table
   */
  private outputTable(data: unknown): void {
    if (!this.isTabular(data)) {
      console.log(chalk.yellow('Data is not suitable for table format, falling back to JSON:'));
      this.outputJson(data);
      return;
    }

    const table = this.createTable(data);
    console.log(table.toString());
  }

  /**
   * Format data as text
   */
  private outputText(data: unknown): void {
    const text = this.formatAsText(data);
    console.log(text);
  }

  /**
   * Create a CLI table from data
   */
  private createTable(data: unknown): SimpleTable {
    if (Array.isArray(data) && data.length > 0) {
      return this.createTableFromArray(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.createTableFromObject(data as Record<string, unknown>);
    } else {
      const table = new SimpleTable();
      table.push([this.formatValue(data), '']);
      return table;
    }
  }

  private createTableFromArray(array: unknown[]): SimpleTable {
    const table = new SimpleTable({
      head: this.extractHeaders(array[0]),
    });

    for (const item of array) {
      if (typeof item === 'object' && item !== null) {
        const row = Object.values(item).map(value => this.formatValue(value));
        table.push(row);
      } else {
        table.push([this.formatValue(item)]);
      }
    }

    return table;
  }

  private createTableFromObject(obj: Record<string, unknown>): SimpleTable {
    const table = new SimpleTable({
      head: ['Property', 'Value'],
    });

    for (const [key, value] of Object.entries(obj)) {
      table.push([key, this.formatValue(value)]);
    }

    return table;
  }

  /**
   * Extract table headers from data structure
   */
  private extractHeaders(item: unknown): string[] {
    if (typeof item === 'object' && item !== null) {
      return Object.keys(item);
    }
    return ['Value'];
  }

  /**
   * Format a value for display
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return this.colors ? chalk.gray('null') : 'null';
    }

    if (typeof value === 'string') {
      return this.colors ? chalk.green(value) : value;
    }

    if (typeof value === 'number') {
      return this.colors ? chalk.yellow(value.toString()) : value.toString();
    }

    if (typeof value === 'boolean') {
      return this.colors ? chalk.blue(value.toString()) : value.toString();
    }

    if (typeof value === 'object') {
      const objValue = value as Record<string, unknown>;
      return this.options.pretty ? JSON.stringify(objValue, null, 2) : JSON.stringify(objValue);
    }

    return String(value);
  }

  /**
   * Format data as plain text
   */
  private formatAsText(data: unknown): string {
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

  /**
   * Check if data is suitable for table format
   */
  private isTabular(data: unknown): boolean {
    if (Array.isArray(data)) {
      return data.length > 0 && data.every(item => typeof item === 'object' && item !== null);
    }

    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length > 0;
    }

    return false;
  }

  /**
   * Create a success message
   */
  public success(message: string, details?: unknown): void {
    const successMsg = this.colors ? chalk.green('✓') : '✓';
    console.log(`${successMsg} ${message}`);

    if (details) {
      this.output(details);
    }
  }

  /**
   * Create an error message
   */
  public error(message: string, details?: unknown): void {
    const errorMsg = this.colors ? chalk.red('✗') : '✗';
    console.error(`${errorMsg} ${message}`);

    if (details) {
      this.output(details);
    }
  }

  /**
   * Create a warning message
   */
  public warning(message: string, details?: unknown): void {
    const warningMsg = this.colors ? chalk.yellow('⚠') : '⚠';
    console.warn(`${warningMsg} ${message}`);

    if (details) {
      this.output(details);
    }
  }

  /**
   * Create an info message
   */
  public info(message: string, details?: unknown): void {
    const infoMsg = this.colors ? chalk.blue('ℹ') : 'ℹ';
    console.log(`${infoMsg} ${message}`);

    if (details) {
      this.output(details);
    }
  }
}

/**
 * Create output formatter from CLI options
 */
export function createOutputFormatter(format?: string, pretty = true, colors = true): OutputFormatter {
  const outputFormat = format === 'text' ? 'text' : format === 'table' ? 'table' : 'json';

  return new OutputFormatter({
    format: outputFormat,
    pretty,
    colors,
  });
}

/**
 * Format and display results consistently across commands
 */
export function displayResults(
  data: unknown,
  title: string,
  format?: string,
  pretty = true
): void {
  const formatter = createOutputFormatter(format, pretty);
  formatter.output(data, title);
}

/**
 * Save output to file
 */
export async function saveOutput(data: unknown, filePath: string, format = 'json'): Promise<void> {
  const { promises: fs } = await import('fs');
  const { dirname } = await import('path');

  // Ensure directory exists
  await fs.mkdir(dirname(filePath), { recursive: true });

  let content: string;

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

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: unknown): string {
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = (row as Record<string, unknown>)[header];
        if (value === null || value === undefined) return '';
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
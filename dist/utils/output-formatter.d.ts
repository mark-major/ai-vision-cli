export interface OutputOptions {
    format: 'json' | 'text' | 'table';
    pretty?: boolean;
    colors?: boolean;
    raw?: boolean;
}
export declare class OutputFormatter {
    private options;
    private colors;
    constructor(options?: OutputOptions);
    output(data: unknown, title?: string): void;
    private outputJson;
    private outputTable;
    private outputText;
    private createTable;
    private createTableFromArray;
    private createTableFromObject;
    private extractHeaders;
    private formatValue;
    private formatAsText;
    private isTabular;
    success(message: string, details?: unknown): void;
    error(message: string, details?: unknown): void;
    warning(message: string, details?: unknown): void;
    info(message: string, details?: unknown): void;
}
export declare function createOutputFormatter(format?: string, pretty?: boolean, colors?: boolean): OutputFormatter;
export declare function displayResults(data: unknown, title: string, format?: string, pretty?: boolean): void;
export declare function saveOutput(data: unknown, filePath: string, format?: string): Promise<void>;
export declare function convertToCSV(data: unknown): string;
//# sourceMappingURL=output-formatter.d.ts.map
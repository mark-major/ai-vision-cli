export interface GlobOptions {
    recursive?: boolean;
    includeHidden?: boolean;
    maxDepth?: number;
    caseSensitive?: boolean;
}
export declare function expandGlob(patterns: string | string[], options?: GlobOptions): Promise<string[]>;
export declare function validateFilePatterns(patterns: string[]): void;
export declare function filterByExtensions(files: string[], extensions: string[]): string[];
export declare function getUniqueFiles(patterns: string[], extensions?: string[]): Promise<string[]>;
export declare function isGlobPattern(pattern: string): boolean;
export declare function splitPatterns(patterns: string[]): {
    simplePaths: string[];
    globPatterns: string[];
};
//# sourceMappingURL=glob-utils.d.ts.map
export declare function expandUser(path: string): string;
export declare function resolvePath(filePath: string, basePath?: string): string;
export declare function getPathInfo(path: string): {
    exists: boolean;
    isFile: boolean;
    isDirectory: boolean;
    absolutePath: string;
};
export declare function getFileExtension(filePath: string): string;
export declare function isUrl(path: string): boolean;
export declare function isRemoteUrl(path: string): boolean;
export declare function isYouTubeUrl(path: string): boolean;
export declare function normalizePath(path: string): string;
export declare function getRelativePath(targetPath: string, basePath: string): string;
export declare function ensureDirectoryExists(filePath: string): Promise<void>;
export declare function isPathWritable(path: string): boolean;
//# sourceMappingURL=path-utils.d.ts.map
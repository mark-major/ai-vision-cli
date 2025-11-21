"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandGlob = expandGlob;
exports.validateFilePatterns = validateFilePatterns;
exports.filterByExtensions = filterByExtensions;
exports.getUniqueFiles = getUniqueFiles;
exports.isGlobPattern = isGlobPattern;
exports.splitPatterns = splitPatterns;
const glob_1 = require("glob");
const path_utils_js_1 = require("./path-utils.js");
const index_js_1 = require("../types/index.js");
async function expandGlob(patterns, options = {}) {
    const { includeHidden = false, maxDepth = 10, caseSensitive = false, } = options;
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];
    const results = [];
    for (const pattern of patternArray) {
        if ((0, path_utils_js_1.isRemoteUrl)(pattern) || (0, path_utils_js_1.isYouTubeUrl)(pattern)) {
            results.push(pattern);
            continue;
        }
        const resolvedPattern = (0, path_utils_js_1.resolvePath)(pattern);
        try {
            const globOptions = {
                dot: includeHidden,
                absolute: true,
                maxDepth,
                nocase: !caseSensitive,
                nodir: true,
                windowsPathsNoEscape: process.platform === 'win32',
            };
            const matches = await (0, glob_1.glob)(resolvedPattern, globOptions);
            results.push(...matches);
        }
        catch (error) {
            throw new index_js_1.ConfigurationError(`Failed to expand glob pattern '${pattern}': ${error instanceof Error ? error.message : String(error)}`, 'GLOB_PATTERN');
        }
    }
    return [...new Set(results)].sort();
}
function validateFilePatterns(patterns) {
    for (const pattern of patterns) {
        if (typeof pattern !== 'string' || pattern.trim().length === 0) {
            throw new index_js_1.ConfigurationError(`Invalid file pattern: ${pattern}`, 'FILE_PATTERN');
        }
        if (pattern.includes('..') && pattern.length > 3) {
            console.warn(`Warning: Pattern '${pattern}' contains parent directory references. Be careful with the path.`);
        }
        if (pattern === '**' || pattern === '/**' || pattern === '**/') {
            console.warn(`Warning: Pattern '${pattern}' will scan the entire filesystem. Consider being more specific.`);
        }
    }
}
function filterByExtensions(files, extensions) {
    const normalizedExtensions = extensions.map(ext => ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`);
    return files.filter(file => {
        const ext = file.toLowerCase().slice(file.lastIndexOf('.'));
        return normalizedExtensions.includes(ext);
    });
}
async function getUniqueFiles(patterns, extensions) {
    validateFilePatterns(patterns);
    const files = await expandGlob(patterns);
    const uniqueFiles = [...new Set(files)];
    if (extensions && extensions.length > 0) {
        return filterByExtensions(uniqueFiles, extensions);
    }
    return uniqueFiles;
}
function isGlobPattern(pattern) {
    return /[*?[\]{}]/.test(pattern);
}
function splitPatterns(patterns) {
    const simplePaths = [];
    const globPatterns = [];
    for (const pattern of patterns) {
        if (isGlobPattern(pattern)) {
            globPatterns.push(pattern);
        }
        else {
            simplePaths.push(pattern);
        }
    }
    return { simplePaths, globPatterns };
}
//# sourceMappingURL=glob-utils.js.map
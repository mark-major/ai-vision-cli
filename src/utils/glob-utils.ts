import { glob } from 'glob';
import { resolvePath, isRemoteUrl, isYouTubeUrl } from './path-utils.js';
import { ConfigurationError } from '../types/index.js';

export interface GlobOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
  caseSensitive?: boolean;
}

/**
 * Expand glob patterns to file paths
 */
export async function expandGlob(patterns: string | string[], options: GlobOptions = {}): Promise<string[]> {
  const {
    includeHidden = false,
    maxDepth = 10,
    caseSensitive = false,
  } = options;

  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  const results: string[] = [];

  for (const pattern of patternArray) {
    // Skip remote URLs
    if (isRemoteUrl(pattern) || isYouTubeUrl(pattern)) {
      results.push(pattern);
      continue;
    }

    // Resolve relative paths
    const resolvedPattern = resolvePath(pattern);

    try {
      const globOptions = {
        dot: includeHidden,
        absolute: true,
        maxDepth,
        nocase: !caseSensitive,
        // Only include files, not directories
        nodir: true,
        // For Windows compatibility
        windowsPathsNoEscape: process.platform === 'win32',
      };

      const matches = await glob(resolvedPattern, globOptions);
      results.push(...matches);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to expand glob pattern '${pattern}': ${error instanceof Error ? error.message : String(error)}`,
        'GLOB_PATTERN'
      );
    }
  }

  // Remove duplicates and sort
  return [...new Set(results)].sort();
}

/**
 * Validate file patterns
 */
export function validateFilePatterns(patterns: string[]): void {
  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new ConfigurationError(
        `Invalid file pattern: ${pattern}`,
        'FILE_PATTERN'
      );
    }

    // Check for potentially dangerous patterns
    if (pattern.includes('..') && pattern.length > 3) {
      console.warn(`Warning: Pattern '${pattern}' contains parent directory references. Be careful with the path.`);
    }

    if (pattern === '**' || pattern === '/**' || pattern === '**/') {
      console.warn(`Warning: Pattern '${pattern}' will scan the entire filesystem. Consider being more specific.`);
    }
  }
}

/**
 * Filter files by extension
 */
export function filterByExtensions(files: string[], extensions: string[]): string[] {
  const normalizedExtensions = extensions.map(ext => ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`);

  return files.filter(file => {
    const ext = file.toLowerCase().slice(file.lastIndexOf('.'));
    return normalizedExtensions.includes(ext);
  });
}

/**
 * Get unique file paths from multiple patterns
 */
export async function getUniqueFiles(patterns: string[], extensions?: string[]): Promise<string[]> {
  validateFilePatterns(patterns);

  const files = await expandGlob(patterns);
  const uniqueFiles = [...new Set(files)];

  if (extensions && extensions.length > 0) {
    return filterByExtensions(uniqueFiles, extensions);
  }

  return uniqueFiles;
}

/**
 * Check if a pattern is a glob pattern (vs a simple file path)
 */
export function isGlobPattern(pattern: string): boolean {
  return /[*?[\]{}]/.test(pattern);
}

/**
 * Split patterns into simple paths and glob patterns
 */
export function splitPatterns(patterns: string[]): {
  simplePaths: string[];
  globPatterns: string[];
} {
  const simplePaths: string[] = [];
  const globPatterns: string[] = [];

  for (const pattern of patterns) {
    if (isGlobPattern(pattern)) {
      globPatterns.push(pattern);
    } else {
      simplePaths.push(pattern);
    }
  }

  return { simplePaths, globPatterns };
}
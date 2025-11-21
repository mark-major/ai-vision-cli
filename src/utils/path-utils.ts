import { join, resolve, dirname, normalize, extname } from 'path';
import { homedir } from 'os';
import { existsSync, lstatSync, accessSync, constants } from 'fs';

/**
 * Expand user home directory (~) in file paths
 */
export function expandUser(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * Resolve a file path to an absolute path
 */
export function resolvePath(filePath: string, basePath?: string): string {
  if (basePath) {
    return resolve(basePath, expandUser(filePath));
  }
  return resolve(expandUser(filePath));
}

/**
 * Check if a path exists and what type it is
 */
export function getPathInfo(path: string): {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  absolutePath: string;
} {
  const absolutePath = resolvePath(path);

  if (!existsSync(absolutePath)) {
    return {
      exists: false,
      isFile: false,
      isDirectory: false,
      absolutePath,
    };
  }

  const stats = lstatSync(absolutePath);

  return {
    exists: true,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    absolutePath,
  };
}

/**
 * Get file extension (without the dot)
 */
export function getFileExtension(filePath: string): string {
  const ext = extname(filePath);
  return ext.slice(1).toLowerCase();
}

/**
 * Check if a file path is a URL
 */
export function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file path is a remote URL (http/https)
 */
export function isRemoteUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Check if a file path is a YouTube URL
 */
export function isYouTubeUrl(path: string): boolean {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.*/;
  return youtubeRegex.test(path);
}

/**
 * Normalize path separators for cross-platform compatibility
 */
export function normalizePath(path: string): string {
  return normalize(path).replace(/\\/g, '/');
}

/**
 * Get a relative path from base to target
 */
export function getRelativePath(targetPath: string, basePath: string): string {
  return normalizePath(relative(dirname(basePath), targetPath));
}

// Polyfill for relative if not available
function relative(from: string, to: string): string {
  const fromParts = normalizePath(from).split('/');
  const toParts = normalizePath(to).split('/');

  // Find common prefix
  let commonLength = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  // Build relative path
  const upCount = fromParts.length - commonLength - 1;
  const toRelative = toParts.slice(commonLength);

  const relativeParts = Array(upCount).fill('..').concat(toRelative);
  return relativeParts.join('/') || '.';
}

/**
 * Ensure a directory exists for a file path
 */
export async function ensureDirectoryExists(filePath: string): Promise<void> {
  const { promises: fs } = await import('fs');
  const dir = dirname(resolvePath(filePath));

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Check if a path is writable
 */
export function isPathWritable(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
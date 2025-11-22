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
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandUser = expandUser;
exports.resolvePath = resolvePath;
exports.getPathInfo = getPathInfo;
exports.getFileExtension = getFileExtension;
exports.isUrl = isUrl;
exports.isRemoteUrl = isRemoteUrl;
exports.isYouTubeUrl = isYouTubeUrl;
exports.normalizePath = normalizePath;
exports.getRelativePath = getRelativePath;
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.isPathWritable = isPathWritable;
const path_1 = require("path");
const os_1 = require("os");
const fs_1 = require("fs");
function expandUser(path) {
    if (path.startsWith('~/')) {
        return (0, path_1.join)((0, os_1.homedir)(), path.slice(2));
    }
    return path;
}
function resolvePath(filePath, basePath) {
    if (basePath) {
        return (0, path_1.resolve)(basePath, expandUser(filePath));
    }
    return (0, path_1.resolve)(expandUser(filePath));
}
function getPathInfo(path) {
    const absolutePath = resolvePath(path);
    if (!(0, fs_1.existsSync)(absolutePath)) {
        return {
            exists: false,
            isFile: false,
            isDirectory: false,
            absolutePath,
        };
    }
    const stats = (0, fs_1.lstatSync)(absolutePath);
    return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        absolutePath,
    };
}
function getFileExtension(filePath) {
    const ext = (0, path_1.extname)(filePath);
    return ext.slice(1).toLowerCase();
}
function isUrl(path) {
    try {
        new URL(path);
        return true;
    }
    catch {
        return false;
    }
}
function isRemoteUrl(path) {
    return path.startsWith('http://') || path.startsWith('https://');
}
function isYouTubeUrl(path) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.*/;
    return youtubeRegex.test(path);
}
function normalizePath(path) {
    return (0, path_1.normalize)(path).replace(/\\/g, '/');
}
function getRelativePath(targetPath, basePath) {
    return normalizePath(relative((0, path_1.dirname)(basePath), targetPath));
}
function relative(from, to) {
    const fromParts = normalizePath(from).split('/');
    const toParts = normalizePath(to).split('/');
    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
        if (fromParts[i] === toParts[i]) {
            commonLength++;
        }
        else {
            break;
        }
    }
    const upCount = fromParts.length - commonLength - 1;
    const toRelative = toParts.slice(commonLength);
    const relativeParts = Array(upCount).fill('..').concat(toRelative);
    return relativeParts.join('/') || '.';
}
async function ensureDirectoryExists(filePath) {
    const { promises: fs } = await Promise.resolve().then(() => __importStar(require('fs')));
    const dir = (0, path_1.dirname)(resolvePath(filePath));
    try {
        await fs.access(dir);
    }
    catch {
        await fs.mkdir(dir, { recursive: true });
    }
}
function isPathWritable(path) {
    try {
        (0, fs_1.accessSync)(path, fs_1.constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=path-utils.js.map
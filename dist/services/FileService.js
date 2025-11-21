"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../types/index.js");
class FileService {
    provider;
    filesThreshold;
    constructor(provider, filesThreshold = 10485760) {
        this.provider = provider;
        this.filesThreshold = filesThreshold;
    }
    async handleImageSource(imageSource) {
        const { buffer, mimeType, filename } = await this.getImageData(imageSource);
        const maxSize = this.getMaxFileSize();
        if (buffer.length > maxSize) {
            throw new index_js_1.FileSizeExceededError(buffer.length, maxSize);
        }
        if (!this.isSupportedFileType(mimeType)) {
            throw new index_js_1.UnsupportedFileTypeError(mimeType, this.getSupportedFileTypes());
        }
        const shouldUpload = buffer.length > this.filesThreshold;
        if (shouldUpload) {
            const uploadedFile = await this.provider.uploadFile(buffer, filename || `image.${this.getFileExtension(mimeType)}`, mimeType);
            const reference = {
                type: 'file_uri',
                uri: uploadedFile.uri,
                mimeType,
            };
            return {
                reference,
                processingInfo: {
                    size: buffer.length,
                    method: 'file_uri',
                    threshold: this.filesThreshold,
                },
            };
        }
        else {
            const reference = {
                type: 'inline_data',
                data: buffer.toString('base64'),
                mimeType,
            };
            return {
                reference,
                processingInfo: {
                    size: buffer.length,
                    method: 'inline_data',
                    threshold: this.filesThreshold,
                },
            };
        }
    }
    async handleMultipleImages(imageSources) {
        const results = [];
        for (const source of imageSources) {
            try {
                const result = await this.handleImageSource(source);
                results.push(result);
            }
            catch (error) {
                throw new index_js_1.FileUploadError(`Failed to process image ${source}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return results;
    }
    async readFile(filePath) {
        const normalizedPath = path_1.default.normalize(filePath);
        try {
            await promises_1.default.access(normalizedPath);
            return await promises_1.default.readFile(normalizedPath);
        }
        catch (error) {
            throw new index_js_1.FileNotFoundError(normalizedPath, 'FileService');
        }
    }
    async getImageData(imageSource) {
        if (imageSource.startsWith('data:image/')) {
            return this.handleBase64Image(imageSource);
        }
        if (imageSource.startsWith('files/') || imageSource.includes('generativelanguage.googleapis.com')) {
            throw new index_js_1.FileUploadError(`File reference already exists: ${imageSource}`);
        }
        if (this.isPublicUrl(imageSource)) {
            return this.handleUrlImage(imageSource);
        }
        if (this.isLocalFilePath(imageSource)) {
            return this.handleLocalFile(imageSource);
        }
        throw new index_js_1.FileUploadError(`Invalid image source format: ${imageSource}`);
    }
    async handleBase64Image(base64Data) {
        const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches) {
            throw new index_js_1.FileUploadError('Invalid base64 image format');
        }
        const mimeType = `image/${matches[1]}`;
        const base64Content = matches[2];
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content) || base64Content.length % 4 !== 0) {
            throw new index_js_1.FileUploadError('Invalid base64 content: contains invalid characters or improper padding');
        }
        try {
            const buffer = Buffer.from(base64Content, 'base64');
            return {
                buffer,
                mimeType,
                filename: `image.${matches[1]}`,
                source: 'base64',
            };
        }
        catch (error) {
            throw new index_js_1.FileUploadError('Failed to decode base64 content: invalid base64 data');
        }
    }
    async handleUrlImage(url) {
        try {
            const decodedUrl = url.replace(/\\&/g, '&');
            const response = await fetch(decodedUrl);
            if (!response.ok) {
                throw new index_js_1.NetworkError(`Failed to fetch image from URL: ${decodedUrl} (Status: ${response.status})`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const urlPath = new URL(decodedUrl).pathname;
            const filename = path_1.default.basename(urlPath) || 'image.jpg';
            const contentType = response.headers.get('content-type');
            const mimeType = contentType && contentType.startsWith('image/')
                ? contentType
                : this.getMimeType(filename, buffer);
            return {
                buffer,
                mimeType,
                filename,
                source: 'url',
            };
        }
        catch (error) {
            if (error instanceof index_js_1.NetworkError) {
                throw error;
            }
            throw new index_js_1.NetworkError(`Failed to download image from URL: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async handleLocalFile(filePath) {
        const normalizedPath = path_1.default.normalize(filePath);
        try {
            await promises_1.default.access(normalizedPath);
            const buffer = await promises_1.default.readFile(normalizedPath);
            const filename = path_1.default.basename(normalizedPath);
            const mimeType = this.getMimeType(filename, buffer);
            return {
                buffer,
                mimeType,
                filename,
                source: 'local',
            };
        }
        catch (error) {
            if (error instanceof Error && ('code' in error ? error.code === 'ENOENT' : error.message.includes('ENOENT'))) {
                throw new index_js_1.FileNotFoundError(normalizedPath, 'FileService');
            }
            if (error instanceof index_js_1.FileNotFoundError) {
                throw error;
            }
            throw new index_js_1.FileUploadError(`Failed to read local file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    isPublicUrl(url) {
        return url.startsWith('http://') || url.startsWith('https://');
    }
    isLocalFilePath(filePath) {
        if (filePath.startsWith('/') ||
            filePath.startsWith('./') ||
            filePath.startsWith('../')) {
            return true;
        }
        if (/^[a-zA-Z]:[\\/]/.test(filePath)) {
            return true;
        }
        if (filePath.startsWith('\\\\')) {
            return true;
        }
        if (filePath.includes('\\') &&
            (filePath.startsWith('.\\') || filePath.startsWith('..\\'))) {
            return true;
        }
        return false;
    }
    getMimeType(filename, buffer) {
        const extension = path_1.default.extname(filename).toLowerCase().substring(1);
        const mimeTypes = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            bmp: 'image/bmp',
            tiff: 'image/tiff',
            heic: 'image/heic',
            heif: 'image/heif',
        };
        const mimeType = mimeTypes[extension];
        if (mimeType) {
            return mimeType;
        }
        if (buffer) {
            return this.getMimeTypeFromBuffer(buffer);
        }
        return extension.includes('jpg') || extension.includes('jpeg')
            ? 'image/jpeg'
            : 'application/octet-stream';
    }
    getMimeTypeFromBuffer(buffer) {
        if (buffer.length >= 8 &&
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47 &&
            buffer[4] === 0x0d &&
            buffer[5] === 0x0a &&
            buffer[6] === 0x1a &&
            buffer[7] === 0x0a) {
            return 'image/png';
        }
        if (buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff) {
            return 'image/jpeg';
        }
        if (buffer.length >= 6 &&
            buffer[0] === 0x47 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x38 &&
            ((buffer[4] === 0x37 && buffer[5] === 0x61) ||
                (buffer[4] === 0x38 && buffer[5] === 0x61))) {
            return 'image/gif';
        }
        if (buffer.length >= 12 &&
            buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46 &&
            buffer[8] === 0x57 &&
            buffer[9] === 0x45 &&
            buffer[10] === 0x42 &&
            buffer[11] === 0x50) {
            return 'image/webp';
        }
        return 'application/octet-stream';
    }
    isSupportedFileType(mimeType) {
        const supportedTypes = this.getSupportedFileTypes();
        return mimeType.startsWith('image/') && supportedTypes.includes(mimeType);
    }
    getSupportedFileTypes() {
        return [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/tiff',
            'image/heic',
            'image/heif'
        ];
    }
    getMaxFileSize() {
        return 20 * 1024 * 1024;
    }
    getFileExtension(mimeType) {
        const extensionMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/tiff': 'tiff',
            'image/heic': 'heic',
            'image/heif': 'heif',
        };
        return extensionMap[mimeType] || 'bin';
    }
}
exports.FileService = FileService;
//# sourceMappingURL=FileService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const generative_ai_1 = require("@google/generative-ai");
const VisionProvider_js_1 = require("../base/VisionProvider.js");
const FileService_js_1 = require("../../services/FileService.js");
const index_js_1 = require("../../types/index.js");
class GeminiProvider extends VisionProvider_js_1.BaseVisionProvider {
    client;
    fileService;
    constructor(apiKey, imageModel) {
        super({
            apiKey,
            baseUrl: 'https://generativelanguage.googleapis.com',
            imageModel,
        }, 'google');
        this.client = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.fileService = new FileService_js_1.FileService(this);
    }
    async analyzeImage(imageSource, prompt, options) {
        const startTime = Date.now();
        try {
            const fileResult = await this.fileService.handleImageSource(imageSource);
            if (options?.debugMode) {
                console.log(`[GeminiProvider] File processing result:`, {
                    method: fileResult.processingInfo.method,
                    size: fileResult.processingInfo.size,
                    threshold: fileResult.processingInfo.threshold,
                    mimeType: fileResult.reference.mimeType,
                });
            }
            const content = this.buildContentFromReference(fileResult.reference, prompt);
            const model = this.client.getGenerativeModel({ model: this.imageModel });
            const config = this.buildConfigWithOptions('image', options?.functionName, options);
            if (options?.debugMode) {
                console.log(`[GeminiProvider] Generation config:`, config);
            }
            const response = await model.generateContent({
                contents: [content],
                generationConfig: config,
            });
            const processingTime = Date.now() - startTime;
            const responseText = response.response.text();
            return this.createAnalysisResult(responseText, this.imageModel, undefined, processingTime, response.response.candidates?.[0]?.finishReason);
        }
        catch (error) {
            throw this.handleError(error, 'analyzeImage');
        }
    }
    async compareImages(imageSources, prompt, options) {
        const startTime = Date.now();
        try {
            if (!imageSources || imageSources.length < 2) {
                throw new index_js_1.VisionError('At least 2 images are required for comparison', 'INVALID_INPUT');
            }
            if (imageSources.length > 4) {
                throw new index_js_1.VisionError('Maximum 4 images can be compared at once', 'INVALID_INPUT');
            }
            const fileService = new FileService_js_1.FileService(this, options?.filesThreshold || 10485760);
            const imageProcessingResults = await fileService.handleMultipleImages(imageSources);
            const contents = [];
            for (const result of imageProcessingResults) {
                if (result.reference.type === 'inline_data') {
                    contents.push({
                        inlineData: {
                            mimeType: result.reference.mimeType,
                            data: result.reference.data
                        }
                    });
                }
                else if (result.reference.type === 'file_uri') {
                    contents.push({
                        fileData: {
                            fileUri: result.reference.uri,
                            mimeType: result.reference.mimeType
                        }
                    });
                }
            }
            contents.push({ text: prompt });
            const config = this.buildConfigWithOptions('image', 'compare_images', options);
            if (options?.debugMode) {
                console.log('Gemini: Processing images for comparison...');
                console.log(`Images: ${imageSources.length}`);
                console.log(`Content parts: ${contents.length}`);
                imageProcessingResults.forEach((result, idx) => {
                    console.log(`  Image ${idx + 1}: ${result.reference.type} (${result.processingInfo.size} bytes)`);
                });
            }
            const model = this.client.getGenerativeModel({ model: this.imageModel });
            const response = await model.generateContent({
                contents: contents,
                generationConfig: config,
            });
            const processingTime = Date.now() - startTime;
            const responseText = response.response?.text() || '';
            return this.createAnalysisResult(responseText, this.imageModel, {
                promptTokenCount: response.response?.usageMetadata?.promptTokenCount || 0,
                candidatesTokenCount: response.response?.usageMetadata?.candidatesTokenCount || 0,
                totalTokenCount: response.response?.usageMetadata?.totalTokenCount || 0,
            }, processingTime);
        }
        catch (error) {
            if (error instanceof index_js_1.VisionError) {
                throw error;
            }
            if (error instanceof Error) {
                if (error.message.includes('quota')) {
                    throw new index_js_1.VisionError('API quota exceeded. Please try again later.', 'QUOTA_EXCEEDED', 'google', error);
                }
                if (error.message.includes('invalid')) {
                    throw new index_js_1.VisionError(`Invalid request: ${error.message}`, 'INVALID_REQUEST', 'google');
                }
            }
            throw new index_js_1.VisionError(`Failed to compare images: ${error instanceof Error ? error.message : String(error)}`, 'COMPARISON_FAILED', 'google', error instanceof Error ? error : new Error(String(error)));
        }
    }
    async uploadFile(buffer, filename, mimeType) {
        return {
            id: filename,
            filename,
            mimeType,
            size: buffer.length,
            uri: `file://${filename}`,
        };
    }
    async downloadFile(_fileId) {
        return Buffer.from('placeholder');
    }
    async deleteFile(_fileId) {
    }
    setModel(imageModel) {
        this.imageModel = imageModel;
    }
    getImageModel() {
        return this.imageModel;
    }
    getSupportedFormats() {
        return {
            supportedImageFormats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
            maxImageSize: 20971520,
            supportsFileUpload: true,
        };
    }
    getModelCapabilities() {
        return {
            imageAnalysis: true,
            maxTokensForImage: 4096,
            supportedFormats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
        };
    }
    getProviderInfo() {
        return {
            name: this.providerName,
            version: '1.0.0',
            description: 'Google Gemini API provider for AI vision analysis',
            capabilities: this.getSupportedFormats(),
            modelCapabilities: this.getModelCapabilities(),
        };
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            const model = this.client.getGenerativeModel({ model: 'gemini-1.5-pro' });
            await model.generateContent('Hello');
            const responseTime = Date.now() - startTime;
            return {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                responseTime,
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: error instanceof Error ? error.message : String(error),
                lastCheck: new Date().toISOString(),
            };
        }
    }
    supportsVideo() {
        return true;
    }
    buildContentFromReference(fileReference, prompt) {
        const parts = [{ text: prompt }];
        switch (fileReference.type) {
            case 'inline_data':
                parts.push({
                    inlineData: {
                        mimeType: fileReference.mimeType,
                        data: fileReference.data,
                    },
                });
                break;
            case 'file_uri':
                parts.push({
                    fileData: {
                        mimeType: fileReference.mimeType,
                        fileUri: fileReference.uri,
                    },
                });
                break;
            case 'base64':
                parts.push({
                    inlineData: {
                        mimeType: fileReference.mimeType,
                        data: fileReference.data,
                    },
                });
                break;
            default:
                throw new index_js_1.VisionError(`Unsupported file reference type: ${fileReference.type}`, 'UNSUPPORTED_FILE_TYPE');
        }
        return {
            role: 'user',
            parts,
        };
    }
    handleError(error, operation) {
        if (error instanceof Error) {
            if (error.message.includes('401') || error.message.includes('UNAUTHENTICATED')) {
                return new index_js_1.AuthenticationError(`Authentication failed for ${operation}: ${error.message}`, this.providerName);
            }
            if (error.message.includes('403') || error.message.includes('PERMISSION_DENIED')) {
                return new index_js_1.AuthenticationError(`Permission denied for ${operation}: ${error.message}`, this.providerName);
            }
            if (error.message.includes('404') || error.message.includes('NOT_FOUND')) {
                return new index_js_1.FileNotFoundError(`Resource not found for ${operation}: ${error.message}`, this.providerName);
            }
            if (error.message.includes('429') || error.message.includes('RATE_LIMIT')) {
                return new index_js_1.RateLimitExceededError(`Rate limit exceeded for ${operation}: ${error.message}`, this.providerName);
            }
            if (error.message.includes('ENOTFOUND') || error.message.includes('NETWORK')) {
                return new index_js_1.NetworkError(`Network error for ${operation}: ${error.message}`);
            }
            return new index_js_1.ProviderError(`Provider error during ${operation}: ${error.message}`, this.providerName, error);
        }
        return new index_js_1.VisionError(`Unknown error during ${operation}: ${String(error)}`, 'PROVIDER_ERROR', this.providerName);
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=GeminiProvider.js.map
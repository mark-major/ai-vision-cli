"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionProviderFactory = void 0;
const GeminiProvider_js_1 = require("../gemini/GeminiProvider.js");
const index_js_1 = require("../../types/index.js");
class VisionProviderFactory {
    static providers = new Map();
    static registerProvider(name, factory) {
        this.providers.set(name, factory);
    }
    static getSupportedProviders() {
        return Array.from(this.providers.keys());
    }
    static async createProvider(providerType, config) {
        switch (providerType) {
            case 'google':
                return this.createGoogleProvider(config);
            case 'vertex_ai':
                return this.createVertexAIProvider(config);
            default:
                throw new index_js_1.ConfigurationError(`Unsupported provider type: ${providerType}`, 'PROVIDER_TYPE');
        }
    }
    static async createGoogleProvider(config) {
        if (!config.credentials.gemini_api_key) {
            throw new index_js_1.ConfigurationError('Gemini API key is required for Google provider. Please set GEMINI_API_KEY environment variable or add it to your configuration.', 'GEMINI_API_KEY');
        }
        const geminiConfig = {
            apiKey: config.credentials.gemini_api_key,
            baseUrl: 'https://generativelanguage.googleapis.com',
            imageModel: config.settings.image_model || 'gemini-1.5-pro',
        };
        return new GeminiProvider_js_1.GeminiProvider(geminiConfig.apiKey, geminiConfig.imageModel);
    }
    static async createVertexAIProvider(config) {
        if (!config.credentials.vertex_credentials) {
            throw new index_js_1.ConfigurationError('Vertex AI credentials are required for Vertex AI provider. Please set VERTEX_CREDENTIALS environment variable or add it to your configuration.', 'VERTEX_CREDENTIALS');
        }
        return this.createGoogleProvider(config);
    }
    static async createProviderWithValidation(providerType, config) {
        try {
            const provider = await this.createProvider(providerType, config);
            return provider;
        }
        catch (error) {
            if (error instanceof index_js_1.ConfigurationError || error instanceof index_js_1.ProviderError) {
                throw error;
            }
            throw new index_js_1.ProviderError(`Failed to create provider ${providerType}: ${error instanceof Error ? error.message : String(error)}`, providerType, error instanceof Error ? error : undefined);
        }
    }
    static async initializeDefaultProviders(config) {
        const providers = new Map();
        try {
            if (config.credentials.gemini_api_key) {
                const googleProvider = await this.createProviderWithValidation('google', config);
                providers.set('google', googleProvider);
            }
            if (config.credentials.vertex_credentials) {
                const vertexAIProvider = await this.createProviderWithValidation('vertex_ai', config);
                providers.set('vertex_ai', vertexAIProvider);
            }
            return providers;
        }
        catch (error) {
            throw new index_js_1.ProviderError(`Failed to initialize providers: ${error instanceof Error ? error.message : String(error)}`, 'PROVIDER_INITIALIZATION');
        }
    }
}
exports.VisionProviderFactory = VisionProviderFactory;
//# sourceMappingURL=ProviderFactory.js.map
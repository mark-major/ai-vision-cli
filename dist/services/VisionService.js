"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionService = void 0;
const ConfigService_js_1 = require("../config/ConfigService.js");
const ProviderFactory_js_1 = require("../providers/factory/ProviderFactory.js");
const index_js_1 = require("../types/index.js");
class VisionService {
    static instance;
    providers = null;
    configService;
    constructor() {
        this.configService = ConfigService_js_1.ConfigService.getInstance();
        this.providers = null;
    }
    static getInstance() {
        if (!VisionService.instance) {
            VisionService.instance = new VisionService();
        }
        return VisionService.instance;
    }
    async initializeProviders(force = false) {
        if (this.providers && !force) {
            return;
        }
        try {
            const config = await this.configService.loadConfig();
            this.providers = await ProviderFactory_js_1.VisionProviderFactory.initializeDefaultProviders(config);
        }
        catch (error) {
            throw new index_js_1.VisionError(`Failed to initialize vision providers: ${error instanceof Error ? error.message : String(error)}`, 'PROVIDER_INITIALIZATION_ERROR');
        }
    }
    async getProvider(providerType) {
        await this.initializeProviders();
        if (!this.providers || this.providers.size === 0) {
            throw new index_js_1.VisionError('No providers are available. Please run "ai-vision init" to set up configuration.', 'NO_PROVIDERS_AVAILABLE');
        }
        let providerName;
        if (providerType) {
            providerName = providerType;
        }
        else {
            const config = await this.configService.loadConfig();
            providerName = config.providers.image || 'google';
        }
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new index_js_1.VisionError(`Provider "${providerName}" is not available. Please check your configuration.`, 'PROVIDER_NOT_AVAILABLE');
        }
        return provider;
    }
    async getAvailableProviders() {
        await this.initializeProviders();
        if (!this.providers) {
            return [];
        }
        return Array.from(this.providers.keys());
    }
    async getProviderInfo(providerType) {
        const provider = await this.getProvider(providerType);
        return provider.getProviderInfo();
    }
    async healthCheck(providerType) {
        const provider = await this.getProvider(providerType);
        return provider.healthCheck();
    }
    resetProviders() {
        this.providers = null;
    }
    async analyzeImage(imageSource, prompt, options, providerType) {
        const provider = await this.getProvider(providerType);
        return provider.analyzeImage(imageSource, prompt, options);
    }
    async compareImages(imageSources, prompt, options, providerType) {
        const provider = await this.getProvider(providerType);
        return provider.compareImages(imageSources, prompt, options);
    }
    async uploadFile(buffer, filename, mimeType, providerType) {
        const provider = await this.getProvider(providerType);
        return provider.uploadFile(buffer, filename, mimeType);
    }
    async downloadFile(fileId, providerType) {
        const provider = await this.getProvider(providerType);
        return provider.downloadFile(fileId);
    }
    async deleteFile(fileId, providerType) {
        const provider = await this.getProvider(providerType);
        return provider.deleteFile(fileId);
    }
    async detectObjects(imageSource, prompt, options, providerType) {
        const provider = await this.getProvider(providerType);
        return provider.analyzeImage(imageSource, prompt, options);
    }
}
exports.VisionService = VisionService;
//# sourceMappingURL=VisionService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseVisionProvider = void 0;
class BaseVisionProvider {
    config;
    imageModel;
    providerName;
    constructor(config, providerName) {
        this.config = config;
        this.providerName = providerName;
        this.imageModel = config.imageModel;
    }
    buildConfigWithOptions(taskType, functionName, options) {
        const config = {
            temperature: this.resolveTemperatureForFunction(taskType, functionName),
            topP: this.resolveTopPForFunction(taskType, functionName),
            topK: this.resolveTopKForFunction(taskType, functionName),
            maxOutputTokens: this.resolveMaxTokensForFunction(taskType, functionName),
            candidateCount: 1,
        };
        if (options?.stopSequences && options.stopSequences.length > 0) {
            config.stopSequences = options.stopSequences;
        }
        if (options?.responseSchema) {
            config.responseMimeType = 'application/json';
            config.responseSchema = options.responseSchema;
        }
        if (options?.systemInstruction) {
            config.systemInstruction = options.systemInstruction;
        }
        return config;
    }
    resolveTemperatureForFunction(taskType, functionName) {
        const envKey = functionName
            ? `TEMPERATURE_FOR_${functionName.toUpperCase()}`
            : undefined;
        if (envKey && process.env[envKey]) {
            return parseFloat(process.env[envKey]);
        }
        const taskKey = `TEMPERATURE_FOR_${taskType.toUpperCase()}`;
        if (process.env[taskKey]) {
            return parseFloat(process.env[taskKey]);
        }
        if (process.env.TEMPERATURE) {
            return parseFloat(process.env.TEMPERATURE);
        }
        return 0.4;
    }
    resolveTopPForFunction(taskType, functionName) {
        const envKey = functionName
            ? `TOP_P_FOR_${functionName.toUpperCase()}`
            : undefined;
        if (envKey && process.env[envKey]) {
            return parseFloat(process.env[envKey]);
        }
        const taskKey = `TOP_P_FOR_${taskType.toUpperCase()}`;
        if (process.env[taskKey]) {
            return parseFloat(process.env[taskKey]);
        }
        if (process.env.TOP_P) {
            return parseFloat(process.env.TOP_P);
        }
        return 0.95;
    }
    resolveTopKForFunction(taskType, functionName) {
        const envKey = functionName
            ? `TOP_K_FOR_${functionName.toUpperCase()}`
            : undefined;
        if (envKey && process.env[envKey]) {
            return parseInt(process.env[envKey]);
        }
        const taskKey = `TOP_K_FOR_${taskType.toUpperCase()}`;
        if (process.env[taskKey]) {
            return parseInt(process.env[taskKey]);
        }
        if (process.env.TOP_K) {
            return parseInt(process.env.TOP_K);
        }
        return 32;
    }
    resolveMaxTokensForFunction(taskType, functionName) {
        const envKey = functionName
            ? `MAX_TOKENS_FOR_${functionName.toUpperCase()}`
            : undefined;
        if (envKey && process.env[envKey]) {
            return parseInt(process.env[envKey]);
        }
        const taskKey = `MAX_TOKENS_FOR_${taskType.toUpperCase()}`;
        if (process.env[taskKey]) {
            return parseInt(process.env[taskKey]);
        }
        if (process.env.MAX_TOKENS) {
            return parseInt(process.env.MAX_TOKENS);
        }
        return 4096;
    }
    createAnalysisResult(text, model, usage, processingTime, responseId) {
        const metadata = {
            model,
            provider: this.providerName,
            usage,
            processingTime,
            modelVersion: model,
            responseId,
        };
        return {
            text,
            metadata,
        };
    }
}
exports.BaseVisionProvider = BaseVisionProvider;
//# sourceMappingURL=VisionProvider.js.map
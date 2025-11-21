import type { VisionProvider } from '../../types/index.js';
import type { CLIConfig } from '../../types/index.js';
export declare class VisionProviderFactory {
    private static providers;
    static registerProvider(name: string, factory: () => Promise<VisionProvider>): void;
    static getSupportedProviders(): string[];
    static createProvider(providerType: 'google' | 'vertex_ai', config: CLIConfig): Promise<VisionProvider>;
    private static createGoogleProvider;
    private static createVertexAIProvider;
    static createProviderWithValidation(providerType: 'google' | 'vertex_ai', config: CLIConfig): Promise<VisionProvider>;
    static initializeDefaultProviders(config: CLIConfig): Promise<Map<'google' | 'vertex_ai', VisionProvider>>;
}
//# sourceMappingURL=ProviderFactory.d.ts.map
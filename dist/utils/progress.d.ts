import { Ora } from 'ora';
import { ProgressCallback } from '../types/index.js';
export declare class ProgressManager {
    private spinners;
    private globalSpinner;
    private showProgress;
    private quietMode;
    constructor(showProgress?: boolean, quietMode?: boolean);
    startSpinner(id: string, text: string): Ora | null;
    updateSpinner(id: string, text: string): void;
    succeedSpinner(id: string, text?: string): void;
    failSpinner(id: string, text?: string): void;
    stopSpinner(id: string): void;
    startGlobal(text: string): void;
    updateGlobal(text: string): void;
    succeedGlobal(text?: string): void;
    failGlobal(text?: string): void;
    stopAll(): void;
    createProgressCallback(operationId: string): ProgressCallback;
    showBatchProgress(current: number, total: number, operation: string): void;
    logProgress(message: string): void;
    logSuccess(message: string): void;
    logWarning(message: string): void;
    logError(message: string): void;
    logInfo(message: string): void;
}
export declare function getProgressManager(showProgress?: boolean, quietMode?: boolean): ProgressManager;
export declare function resetProgressManager(): void;
export declare function withProgress<T>(text: string, operation: (progress?: ProgressCallback) => Promise<T>, operationId?: string, showProgress?: boolean): Promise<T>;
export declare function withBatchProgress<T>(items: T[], operation: string, batchOperation: (item: T, index: number) => Promise<void>, showProgress?: boolean): Promise<void>;
//# sourceMappingURL=progress.d.ts.map
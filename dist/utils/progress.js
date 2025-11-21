"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressManager = void 0;
exports.getProgressManager = getProgressManager;
exports.resetProgressManager = resetProgressManager;
exports.withProgress = withProgress;
exports.withBatchProgress = withBatchProgress;
const ora_1 = __importDefault(require("ora"));
const chalk_1 = __importDefault(require("chalk"));
class ProgressManager {
    spinners = new Map();
    globalSpinner = null;
    showProgress;
    quietMode;
    constructor(showProgress = true, quietMode = false) {
        this.showProgress = showProgress && !quietMode;
        this.quietMode = quietMode;
    }
    startSpinner(id, text) {
        if (!this.showProgress)
            return null;
        const spinner = (0, ora_1.default)({
            text: chalk_1.default.cyan(text),
            color: 'cyan',
        }).start();
        this.spinners.set(id, spinner);
        return spinner;
    }
    updateSpinner(id, text) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.text = chalk_1.default.cyan(text);
        }
    }
    succeedSpinner(id, text) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.succeed(text ? chalk_1.default.green(text) : undefined);
            this.spinners.delete(id);
        }
    }
    failSpinner(id, text) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.fail(text ? chalk_1.default.red(text) : undefined);
            this.spinners.delete(id);
        }
    }
    stopSpinner(id) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.stop();
            this.spinners.delete(id);
        }
    }
    startGlobal(text) {
        if (!this.showProgress)
            return;
        this.globalSpinner = (0, ora_1.default)({
            text: chalk_1.default.cyan(text),
            color: 'cyan',
        }).start();
    }
    updateGlobal(text) {
        if (this.globalSpinner) {
            this.globalSpinner.text = chalk_1.default.cyan(text);
        }
    }
    succeedGlobal(text) {
        if (this.globalSpinner) {
            this.globalSpinner.succeed(text ? chalk_1.default.green(text) : undefined);
            this.globalSpinner = null;
        }
    }
    failGlobal(text) {
        if (this.globalSpinner) {
            this.globalSpinner.fail(text ? chalk_1.default.red(text) : undefined);
            this.globalSpinner = null;
        }
    }
    stopAll() {
        for (const spinner of this.spinners.values()) {
            spinner.stop();
        }
        this.spinners.clear();
        if (this.globalSpinner) {
            this.globalSpinner.stop();
            this.globalSpinner = null;
        }
    }
    createProgressCallback(operationId) {
        return (progress) => {
            if (!this.showProgress)
                return;
            const percentage = progress.percentage ? `${progress.percentage}%` : '';
            const eta = progress.eta ? `ETA: ${Math.round(progress.eta)}s` : '';
            const message = `${progress.message}${percentage ? ` ${percentage}` : ''}${eta ? ` (${eta})` : ''}`;
            this.updateSpinner(operationId, message);
        };
    }
    showBatchProgress(current, total, operation) {
        if (!this.showProgress)
            return;
        const percentage = Math.round((current / total) * 100);
        const barLength = 30;
        const filledLength = Math.round((percentage / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        console.log(chalk_1.default.cyan(`${operation}:`), chalk_1.default.blue(`[${bar}]`), chalk_1.default.yellow(`${current}/${total} (${percentage}%)`));
    }
    logProgress(message) {
        if (!this.quietMode) {
            console.log(chalk_1.default.blue('ℹ'), message);
        }
    }
    logSuccess(message) {
        if (!this.quietMode) {
            console.log(chalk_1.default.green('✓'), message);
        }
    }
    logWarning(message) {
        if (!this.quietMode) {
            console.log(chalk_1.default.yellow('⚠'), message);
        }
    }
    logError(message) {
        if (!this.quietMode) {
            console.log(chalk_1.default.red('✗'), message);
        }
    }
    logInfo(message) {
        if (!this.quietMode) {
            console.log(chalk_1.default.blue('ℹ'), message);
        }
    }
}
exports.ProgressManager = ProgressManager;
let defaultProgressManager = null;
function getProgressManager(showProgress, quietMode) {
    if (!defaultProgressManager) {
        const globalShowProgress = showProgress !== undefined ? showProgress : process.env.QUIET !== 'true';
        const globalQuietMode = quietMode !== undefined ? quietMode : process.env.QUIET === 'true';
        defaultProgressManager = new ProgressManager(globalShowProgress, globalQuietMode);
    }
    return defaultProgressManager;
}
function resetProgressManager() {
    if (defaultProgressManager) {
        defaultProgressManager.stopAll();
        defaultProgressManager = null;
    }
}
async function withProgress(text, operation, operationId, showProgress = true) {
    const progressManager = getProgressManager(showProgress);
    const id = operationId || `operation-${Date.now()}`;
    if (showProgress) {
        progressManager.startSpinner(id, text);
    }
    try {
        const progressCallback = progressManager.createProgressCallback(id);
        const result = await operation(progressCallback);
        if (showProgress) {
            progressManager.succeedSpinner(id);
        }
        return result;
    }
    catch (error) {
        if (showProgress) {
            progressManager.failSpinner(id);
        }
        throw error;
    }
}
async function withBatchProgress(items, operation, batchOperation, showProgress = true) {
    const progressManager = getProgressManager(showProgress);
    if (showProgress) {
        progressManager.startGlobal(operation);
    }
    try {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (showProgress && items.length > 1) {
                progressManager.showBatchProgress(i + 1, items.length, operation);
            }
            await batchOperation(item, i);
        }
        if (showProgress) {
            progressManager.succeedGlobal(`Completed ${operation} (${items.length} items)`);
        }
    }
    catch (error) {
        if (showProgress) {
            progressManager.failGlobal(`Failed ${operation}`);
        }
        throw error;
    }
}
//# sourceMappingURL=progress.js.map
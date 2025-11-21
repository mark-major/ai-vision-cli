import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { ProgressInfo, ProgressCallback } from '../types/index.js';

export class ProgressManager {
  private spinners: Map<string, Ora> = new Map();
  private globalSpinner: Ora | null = null;
  private showProgress: boolean;
  private quietMode: boolean;

  constructor(showProgress = true, quietMode = false) {
    this.showProgress = showProgress && !quietMode;
    this.quietMode = quietMode;
  }

  /**
   * Start a progress spinner for a specific operation
   */
  public startSpinner(id: string, text: string): Ora | null {
    if (!this.showProgress) return null;

    const spinner = ora({
      text: chalk.cyan(text),
      color: 'cyan',
    }).start();

    this.spinners.set(id, spinner);
    return spinner;
  }

  /**
   * Update spinner text
   */
  public updateSpinner(id: string, text: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.text = chalk.cyan(text);
    }
  }

  /**
   * Succeed a spinner
   */
  public succeedSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.succeed(text ? chalk.green(text) : undefined);
      this.spinners.delete(id);
    }
  }

  /**
   * Fail a spinner
   */
  public failSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.fail(text ? chalk.red(text) : undefined);
      this.spinners.delete(id);
    }
  }

  /**
   * Stop a spinner without success/fail
   */
  public stopSpinner(id: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(id);
    }
  }

  /**
   * Start a global progress spinner
   */
  public startGlobal(text: string): void {
    if (!this.showProgress) return;

    this.globalSpinner = ora({
      text: chalk.cyan(text),
      color: 'cyan',
    }).start();
  }

  /**
   * Update global spinner
   */
  public updateGlobal(text: string): void {
    if (this.globalSpinner) {
      this.globalSpinner.text = chalk.cyan(text);
    }
  }

  /**
   * Succeed global spinner
   */
  public succeedGlobal(text?: string): void {
    if (this.globalSpinner) {
      this.globalSpinner.succeed(text ? chalk.green(text) : undefined);
      this.globalSpinner = null;
    }
  }

  /**
   * Fail global spinner
   */
  public failGlobal(text?: string): void {
    if (this.globalSpinner) {
      this.globalSpinner.fail(text ? chalk.red(text) : undefined);
      this.globalSpinner = null;
    }
  }

  /**
   * Stop all spinners
   */
  public stopAll(): void {
    // Stop all individual spinners
    for (const spinner of this.spinners.values()) {
      spinner.stop();
    }
    this.spinners.clear();

    // Stop global spinner
    if (this.globalSpinner) {
      this.globalSpinner.stop();
      this.globalSpinner = null;
    }
  }

  /**
   * Create a progress callback function for long operations
   */
  public createProgressCallback(operationId: string): ProgressCallback {
    return (progress: ProgressInfo) => {
      if (!this.showProgress) return;

      const percentage = progress.percentage ? `${progress.percentage}%` : '';
      const eta = progress.eta ? `ETA: ${Math.round(progress.eta)}s` : '';

      const message = `${progress.message}${percentage ? ` ${percentage}` : ''}${eta ? ` (${eta})` : ''}`;
      this.updateSpinner(operationId, message);
    };
  }

  /**
   * Show a simple progress bar for batch operations
   */
  public showBatchProgress(current: number, total: number, operation: string): void {
    if (!this.showProgress) return;

    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    console.log(
      chalk.cyan(`${operation}:`),
      chalk.blue(`[${bar}]`),
      chalk.yellow(`${current}/${total} (${percentage}%)`)
    );
  }

  /**
   * Log progress without spinner (for quiet mode)
   */
  public logProgress(message: string): void {
    if (!this.quietMode) {
      console.log(chalk.blue('ℹ'), message);
    }
  }

  /**
   * Log success message
   */
  public logSuccess(message: string): void {
    if (!this.quietMode) {
      console.log(chalk.green('✓'), message);
    }
  }

  /**
   * Log warning message
   */
  public logWarning(message: string): void {
    if (!this.quietMode) {
      console.log(chalk.yellow('⚠'), message);
    }
  }

  /**
   * Log error message
   */
  public logError(message: string): void {
    if (!this.quietMode) {
      console.log(chalk.red('✗'), message);
    }
  }

  /**
   * Log info message
   */
  public logInfo(message: string): void {
    if (!this.quietMode) {
      console.log(chalk.blue('ℹ'), message);
    }
  }
}

/**
 * Default progress manager instance
 */
let defaultProgressManager: ProgressManager | null = null;

export function getProgressManager(showProgress?: boolean, quietMode?: boolean): ProgressManager {
  if (!defaultProgressManager) {
    const globalShowProgress = showProgress !== undefined ? showProgress : process.env.QUIET !== 'true';
    const globalQuietMode = quietMode !== undefined ? quietMode : process.env.QUIET === 'true';
    defaultProgressManager = new ProgressManager(globalShowProgress, globalQuietMode);
  }
  return defaultProgressManager;
}

export function resetProgressManager(): void {
  if (defaultProgressManager) {
    defaultProgressManager.stopAll();
    defaultProgressManager = null;
  }
}

/**
 * Helper function to run an operation with progress indication
 */
export async function withProgress<T>(
  text: string,
  operation: (progress?: ProgressCallback) => Promise<T>,
  operationId?: string,
  showProgress = true
): Promise<T> {
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
  } catch (error) {
    if (showProgress) {
      progressManager.failSpinner(id);
    }
    throw error;
  }
}

/**
 * Helper function to run a batch operation with progress
 */
export async function withBatchProgress<T>(
  items: T[],
  operation: string,
  batchOperation: (item: T, index: number) => Promise<void>,
  showProgress = true
): Promise<void> {
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
  } catch (error) {
    if (showProgress) {
      progressManager.failGlobal(`Failed ${operation}`);
    }
    throw error;
  }
}
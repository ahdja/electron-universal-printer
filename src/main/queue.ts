import { PrintJob, PrinterConfig } from '../types';
import { handlePrintJob } from './core';

interface QueueItem {
  config: PrinterConfig;
  job: PrintJob;
  resolve: (value: boolean) => void;
  reject: (reason: any) => void;
}

class PrintQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing = false;

  public enqueue(config: PrinterConfig, job: PrintJob): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.queue.push({ config, job, resolve, reject });
      this.next();
    });
  }

  private async next() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const currentItem = this.queue.shift();

    if (currentItem) {
      try {
        const result = await handlePrintJob(currentItem.config, currentItem.job);
        currentItem.resolve(result);
      } catch (error) {
        currentItem.reject(error);
      } finally {
        this.isProcessing = false;
        setTimeout(() => this.next(), 500); // Jeda 500ms antar antrean
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const printQueue = new PrintQueueManager();
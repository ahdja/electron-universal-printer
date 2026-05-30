import { PrintJob, PrinterConfig } from '../types';
import { handlePrintJob } from './core';

interface QueueItem {
  config: PrinterConfig;
  job: PrintJob;
  resolve: (value: boolean) => void;
  reject: (reason: any) => void;
}

// Cap pending jobs so a misbehaving/compromised renderer can't pin unbounded
// memory by flooding print calls faster than they drain (1 per ~500ms).
const MAX_QUEUE = 200;

class PrintQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing = false;

  public enqueue(config: PrinterConfig, job: PrintJob): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= MAX_QUEUE) {
        return reject(new Error(`Print queue penuh (>${MAX_QUEUE} antrean). Coba lagi nanti.`));
      }
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
        // Only pause when more jobs remain, so an idle queue has no latency floor.
        if (this.queue.length > 0) {
          setTimeout(() => this.next(), 500); // Jeda 500ms antar antrean
        }
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const printQueue = new PrintQueueManager();
import { IpcMain } from 'electron';
import { PrinterConfig, PrintJob, PrinterType } from '../types';
import { getOSPrinters } from './core';
import { getPrinterStatus } from './engine-cli';
import { getHotfolderStatus } from './hotfolder';
import { printQueue } from './queue';

let registeredPrinters: Record<string, PrinterConfig> = {};

// Reject oversized payloads before they pin memory / fill disk. A renderer
// sends print data over IPC; without a cap a single call can allocate GBs.
const MAX_DATA_BYTES = 64 * 1024 * 1024; // 64 MiB

function dataByteLength(data: string | Buffer): number {
  return Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf8');
}

export function registerElectronPrinter(ipcMain: IpcMain, configs: PrinterConfig[]) {
  configs.forEach((config) => {
    registeredPrinters[config.id] = config;
  });

  ipcMain.handle('gvs-printer:list', async () => {
    return await getOSPrinters();
  });

  ipcMain.handle('gvs-printer:print', async (_event, job: PrintJob) => {
    if (!job || typeof job.printerId !== 'string' || job.data == null) {
      throw new Error('Print job tidak valid: `printerId` dan `data` wajib diisi.');
    }
    if (dataByteLength(job.data) > MAX_DATA_BYTES) {
      throw new Error(`Data cetak melebihi batas ${MAX_DATA_BYTES} byte.`);
    }

    let config = registeredPrinters[job.printerId];

    // Fallback for printers driven dynamically from the UI (not pre-registered).
    // Route to hotfolder when the id signals it or a hotfolderPath is supplied.
    if (!config) {
      const isHotfolder = job.printerId === 'HOTFOLDER' || !!job.options?.hotfolderPath;
      config = { id: job.printerId, type: isHotfolder ? 'hotfolder' : 'driver' };
    }
    return await printQueue.enqueue(config, job);
  });

  ipcMain.handle(
    'gvs-printer:status',
    async (
      _event,
      { printerId, type, hotfolderPath }: { printerId: string; type: PrinterType; hotfolderPath?: string },
    ) => {
      const queueCount = printQueue.getQueueLength();
      if (type === 'hotfolder') {
        return { status: getHotfolderStatus(hotfolderPath), queueCount };
      }
      const status = await getPrinterStatus(printerId);
      return { status, queueCount };
    },
  );
}

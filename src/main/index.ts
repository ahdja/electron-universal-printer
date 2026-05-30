import { IpcMain } from 'electron';
import { PrinterConfig, PrintJob } from '../types';
import { getOSPrinters } from './core';
import { getPrinterStatus, execCliPrint } from './engine-cli';
import { getHotfolderStatus } from './hotfolder';
import { printQueue } from './queue';

let registeredPrinters: Record<string, PrinterConfig> = {};

export function registerElectronPrinter(ipcMain: IpcMain, configs: PrinterConfig[]) {
  configs.forEach(config => {
    registeredPrinters[config.id] = config;
  });

  ipcMain.handle('gvs-printer:list', async () => {
    return await getOSPrinters();
  });

  ipcMain.handle('gvs-printer:print', async (_event, job: PrintJob) => {
    let config = registeredPrinters[job.printerId];
    
    // Fallback jika tidak didaftarkan di awal (dinamis dari UI)
    if (!config) {
      config = { id: job.printerId, type: job.printerId === 'HOTFOLDER' ? 'hotfolder' : 'driver' };
    }
    return await printQueue.enqueue(config, job);
  });

  ipcMain.handle('gvs-printer:status', async (_event, { printerId, type, hotfolderPath }) => {
    const queueCount = printQueue.getQueueLength();
    if (type === 'hotfolder') {
      return { status: getHotfolderStatus(hotfolderPath), queueCount };
    } else {
      const status = await getPrinterStatus(printerId);
      return { status, queueCount };
    }
  });
}
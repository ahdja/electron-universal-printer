import { IpcRenderer } from 'electron';
import { InputType, PrinterType } from '../types';

export function getPrinterPreloadAPI(ipcRenderer: IpcRenderer) {
  return {
    getPrinters: () => ipcRenderer.invoke('gvs-printer:list'),
    print: (printerId: string, payload: { type: InputType; data: any; options?: any }) => {
      return ipcRenderer.invoke('gvs-printer:print', { printerId, ...payload });
    },
    getStatus: (printerId: string, type: PrinterType, hotfolderPath?: string) => {
      return ipcRenderer.invoke('gvs-printer:status', { printerId, type, hotfolderPath });
    },
  };
}

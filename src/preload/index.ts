import { IpcRenderer } from 'electron';

export function getPrinterPreloadAPI(ipcRenderer: IpcRenderer) {
  return {
    getPrinters: () => ipcRenderer.invoke('gvs-printer:list'),
    print: (printerId: string, payload: { type: string; data: any; options?: any }) => {
      return ipcRenderer.invoke('gvs-printer:print', { printerId, ...payload });
    },
    getStatus: (printerId: string, type: 'driver' | 'hotfolder', hotfolderPath?: string) => {
      return ipcRenderer.invoke('gvs-printer:status', { printerId, type, hotfolderPath });
    }
  };
}
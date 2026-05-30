import { PrinterStatusPayload } from '../types';

export const electronPrinter = {
  getPrinters: async (): Promise<any[]> => {
    return await (window as any).electronPrinter?.getPrinters();
  },
  print: async (printerId: string, payload: { type: 'html' | 'image' | 'pdf' | 'raw'; data: any; options?: any }): Promise<boolean> => {
    return await (window as any).electronPrinter?.print(printerId, payload);
  },
  getStatus: async (printerId: string, type: 'driver' | 'hotfolder', hotfolderPath?: string): Promise<PrinterStatusPayload> => {
    return await (window as any).electronPrinter?.getStatus(printerId, type, hotfolderPath);
  }
};

export default electronPrinter;
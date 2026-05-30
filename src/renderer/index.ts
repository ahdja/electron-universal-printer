import { InputType, PrinterType, PrinterStatusPayload, OSPrinter } from '../types';

export const electronPrinter = {
  getPrinters: async (): Promise<OSPrinter[]> => {
    return await (window as any).electronPrinter?.getPrinters();
  },
  print: async (
    printerId: string,
    payload: { type: InputType; data: any; options?: any },
  ): Promise<boolean> => {
    return await (window as any).electronPrinter?.print(printerId, payload);
  },
  getStatus: async (
    printerId: string,
    type: PrinterType,
    hotfolderPath?: string,
  ): Promise<PrinterStatusPayload> => {
    return await (window as any).electronPrinter?.getStatus(printerId, type, hotfolderPath);
  },
};

export default electronPrinter;

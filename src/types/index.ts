export type PrinterType = 'driver' | 'hotfolder';
export type InputType = 'html' | 'image' | 'pdf' | 'raw';
export type PrintEngine = 'cli' | 'native';

export interface HotfolderSizes {
  [size: string]: string;
}

export interface PrinterConfig {
  id: string;
  type: PrinterType;
  name?: string;          
  sizes?: HotfolderSizes; 
}

export interface PrintJobOptions {
  engine?: PrintEngine;
  size?: string;          
  silent?: boolean;
  hotfolderPath?: string; 
}

export interface PrintJob {
  printerId: string;
  type: InputType;
  data: string | Buffer;  
  options?: PrintJobOptions;
}

export type PrinterStatusResult = 'READY' | 'PRINTING' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';

export interface PrinterStatusPayload {
  status: PrinterStatusResult;
  queueCount: number;
}
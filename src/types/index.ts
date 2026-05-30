export type PrinterType = 'driver' | 'hotfolder';
export type InputType = 'html' | 'image' | 'pdf' | 'raw';

export interface HotfolderSizes {
  [size: string]: string;
}

export interface PrinterConfig {
  id: string;
  type: PrinterType;
  name?: string;          // OS driver name (defaults to id)
  hotfolderPath?: string; // default hotfolder path for this printer
  sizes?: HotfolderSizes; // size key -> subfolder name written under hotfolderPath
}

export interface PrintJobOptions {
  size?: string;          // hotfolder size key (looked up in PrinterConfig.sizes)
  hotfolderPath?: string; // overrides PrinterConfig.hotfolderPath
}

export interface PrintJob {
  printerId: string;
  type: InputType;
  data: string | Buffer;  // markup / data-URL / file path / raw text
  options?: PrintJobOptions;
}

export type PrinterStatusResult = 'READY' | 'PRINTING' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';

export interface PrinterStatusPayload {
  status: PrinterStatusResult;
  queueCount: number;
}

export interface OSPrinter {
  name: string;
  isDefault: boolean;
  status: PrinterStatusResult;
}

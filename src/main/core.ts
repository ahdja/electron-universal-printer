import { PrintJob, PrinterConfig, OSPrinter } from '../types';
import { handleHotfolderPrint } from './hotfolder';
import { execCliPrint } from './engine-cli';
import { run } from './util';

const PS_LIST = ['-NoProfile', '-NonInteractive', '-Command'];
const PS_LIST_CMD =
  'Get-CimInstance Win32_Printer | Select-Object Name,Default | ConvertTo-Json -Compress';

export async function getOSPrinters(): Promise<OSPrinter[]> {
  if (process.platform === 'win32') {
    try {
      const out = await run('powershell', [...PS_LIST, PS_LIST_CMD]);
      if (!out.trim()) return [];
      const parsed = JSON.parse(out);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows
        .filter((r) => r && r.Name)
        .map((r) => ({ name: String(r.Name), isDefault: r.Default === true, status: 'READY' as const }));
    } catch {
      return [];
    }
  }

  try {
    const out = await run('lpstat', ['-p']);
    return out
      .split('\n')
      .filter((line) => line.startsWith('printer'))
      .map((line) => {
        const name = line.split(/\s+/)[1] || '';
        return { name, isDefault: false, status: 'READY' as const };
      })
      .filter((p) => p.name);
  } catch {
    return [];
  }
}

export async function handlePrintJob(config: PrinterConfig, job: PrintJob): Promise<boolean> {
  if (config.type === 'hotfolder') {
    return await handleHotfolderPrint(config, job);
  }
  const targetPrinterName = config.name || job.printerId;
  return await execCliPrint(job, targetPrinterName);
}

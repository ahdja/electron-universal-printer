import { exec } from 'child_process';
import { PrintJob, PrinterConfig } from '../types';
import { handleHotfolderPrint } from './hotfolder';
import { execCliPrint } from './engine-cli';

export function getOSPrinters(): Promise<any[]> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const cmd = `powershell -Command "Get-CimInstance Win32_Printer | Select-Object Name, IsDefault"`;
      exec(cmd, (err, stdout) => {
        if (err) return resolve([]);
        const lines = stdout.split('\r\n').filter(line => line.trim() !== '');
        const printers = lines.slice(2).map(line => {
          const parts = line.trim().split(/\s{2,}/);
          return { name: parts[0], isDefault: parts[1] === 'True', status: 'READY' };
        });
        resolve(printers);
      });
    } else {
      exec('lpstat -p', (err, stdout) => {
        if (err) return resolve([]);
        const printers = stdout.split('\n')
          .filter(line => line.startsWith('printer'))
          .map(line => ({ name: line.split(' ')[1], isDefault: false, status: 'READY' }));
        resolve(printers);
      });
    }
  });
}

export async function handlePrintJob(config: PrinterConfig, job: PrintJob): Promise<boolean> {
  if (config.type === 'hotfolder' || job.printerId === 'HOTFOLDER') {
    return await handleHotfolderPrint(job);
  }
  const targetPrinterName = config.name || job.printerId;
  return await execCliPrint(job, targetPrinterName);
}
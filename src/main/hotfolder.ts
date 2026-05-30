import * as fs from 'fs';
import * as path from 'path';
import { PrintJob, PrinterStatusResult } from '../types';

export async function handleHotfolderPrint(job: PrintJob): Promise<boolean> {
  const { data, options } = job;
  const targetFolder = options?.hotfolderPath;
  const size = options?.size || 'default';

  if (!targetFolder) {
    throw new Error("Gagal cetak: `hotfolderPath` wajib disertakan untuk mode hotfolder.");
  }

  try {
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1000);
    const fileName = `print_${size}_${timestamp}_${randomId}.jpg`;
    const finalPath = path.join(targetFolder, fileName);

    const base64Data = data.toString().replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.promises.writeFile(finalPath, buffer);
    return true;
  } catch (error: any) {
    throw new Error(`Hotfolder Write Error: ${error.message}`);
  }
}

export function getHotfolderStatus(folderPath?: string): PrinterStatusResult {
  if (!folderPath) return 'UNKNOWN';
  try {
    return fs.existsSync(folderPath) ? 'READY' : 'OFFLINE';
  } catch {
    return 'ERROR';
  }
}
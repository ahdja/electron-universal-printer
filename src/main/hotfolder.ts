import * as fs from 'fs';
import * as crypto from 'crypto';
import { PrintJob, PrinterConfig, PrinterStatusResult } from '../types';
import { decodeDataUrl, sanitizeSegment, safeJoin } from './util';

export async function handleHotfolderPrint(config: PrinterConfig, job: PrintJob): Promise<boolean> {
  const { data, options } = job;
  // A registered config's hotfolderPath is a TRUSTED root and takes precedence:
  // a renderer cannot redirect writes away from it. Only when no registered root
  // exists (fully dynamic printer) do we fall back to the renderer-supplied path.
  const targetFolder = config.hotfolderPath || options?.hotfolderPath;
  const sizeKey = options?.size || 'default';

  if (!targetFolder) {
    throw new Error('Gagal cetak: `hotfolderPath` wajib disertakan untuk mode hotfolder.');
  }

  // Resolve the size key to a subfolder via config.sizes, sanitized so a
  // malicious key can never traverse outside the hotfolder.
  const mapped = config.sizes?.[sizeKey] ?? sizeKey;
  const subfolder = sanitizeSegment(mapped);
  const fileName = `print_${sanitizeSegment(sizeKey)}_${Date.now()}_${crypto.randomUUID()}.jpg`;

  // safeJoin throws if subfolder/fileName try to escape targetFolder.
  const destDir = safeJoin(targetFolder, subfolder);
  const finalPath = safeJoin(destDir, fileName);

  try {
    await fs.promises.mkdir(destDir, { recursive: true });
    const buffer = typeof data === 'string' ? decodeDataUrl(data) : data;
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

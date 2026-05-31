import * as fs from 'fs';
import { PrintJob, PrinterStatusResult } from '../types';
import { run, runPwsh, runWithInput, createTempFile } from './util';

// PowerShell scripts are CONSTANTS with no interpolation. Every user value is
// read at runtime via $env:EUP_* — environment values are inert string data
// and are never parsed as PowerShell/shell code, so injection is impossible.
const PS_PRINT_FILE =
  "$ErrorActionPreference='Stop'; " +
  'Start-Process -FilePath $env:EUP_FILE -Verb PrintTo -ArgumentList $env:EUP_NAME -WindowStyle Hidden -Wait';

// Image print via GDI PrintDocument. Does NOT rely on a PrintTo verb / associated
// app (which images often lack), so it works on regular and thermal POS printers
// that expose a Windows driver. Image is scaled to the printable area preserving
// aspect ratio so it does not stretch on narrow 58/80mm thermal paper.
const PS_PRINT_IMAGE =
  "$ErrorActionPreference='Stop'; " +
  'Add-Type -AssemblyName System.Drawing; ' +
  '$img = [System.Drawing.Image]::FromFile($env:EUP_FILE); ' +
  '$pd = New-Object System.Drawing.Printing.PrintDocument; ' +
  '$pd.PrinterSettings.PrinterName = $env:EUP_NAME; ' +
  '$pd.add_PrintPage({ param($s,$e) ' +
  '$area = $e.MarginBounds; ' +
  '$ratio = [Math]::Min($area.Width / $img.Width, $area.Height / $img.Height); ' +
  '$w = [int]($img.Width * $ratio); $h = [int]($img.Height * $ratio); ' +
  '$e.Graphics.DrawImage($img, $area.Left, $area.Top, $w, $h) }); ' +
  'try { $pd.Print() } finally { $img.Dispose(); $pd.Dispose() }';

const PS_PRINT_RAW =
  "$ErrorActionPreference='Stop'; Out-Printer -Name $env:EUP_NAME -InputObject $env:EUP_DATA";

const PS_STATUS =
  "$ErrorActionPreference='SilentlyContinue'; " +
  'Get-CimInstance Win32_Printer -Filter ("Name=\'" + ($env:EUP_NAME -replace "\'","\'\'") + "\'") | ' +
  'Select-Object PrinterStatus,DetectedErrorState,WorkOffline | ConvertTo-Json -Compress';

function isWindows(): boolean {
  return process.platform === 'win32';
}

export async function execCliPrint(job: PrintJob, printerName: string): Promise<boolean> {
  if (job.type === 'raw') {
    const raw = job.data.toString();
    if (isWindows()) {
      await runPwsh(PS_PRINT_RAW, { EUP_NAME: printerName, EUP_DATA: raw });
    } else {
      await runWithInput('lp', ['-d', printerName, '-o', 'raw'], job.data);
    }
    return true;
  }

  // Materialize html/image/pdf to a file. Existing PDF paths print in place.
  let filePath = '';
  let isTemp = true;
  if (job.type === 'pdf' && fs.existsSync(job.data.toString())) {
    filePath = job.data.toString();
    isTemp = false;
  } else {
    const ext = job.type === 'image' ? 'jpg' : job.type === 'pdf' ? 'pdf' : 'html';
    filePath = createTempFile(job.data, ext);
  }

  try {
    if (isWindows()) {
      const script = job.type === 'image' ? PS_PRINT_IMAGE : PS_PRINT_FILE;
      await runPwsh(script, { EUP_NAME: printerName, EUP_FILE: filePath });
    } else {
      // '--' stops option parsing so a filePath starting with '-' is treated as a path.
      await run('lp', ['-d', printerName, '--', filePath]);
    }
    return true;
  } finally {
    if (isTemp) {
      fs.promises.unlink(filePath).catch(() => { /* already gone */ });
    }
  }
}

export async function getPrinterStatus(printerName: string): Promise<PrinterStatusResult> {
  if (isWindows()) {
    try {
      const out = await runPwsh(PS_STATUS, { EUP_NAME: printerName });
      if (!out.trim()) return 'UNKNOWN';
      const info = JSON.parse(out);
      if (info.WorkOffline === true) return 'OFFLINE';
      if (typeof info.DetectedErrorState === 'number' && info.DetectedErrorState > 2) return 'ERROR';
      switch (info.PrinterStatus) {
        case 3: return 'READY';
        case 4: case 5: return 'PRINTING';
        case 7: return 'OFFLINE';
        default: return 'UNKNOWN';
      }
    } catch {
      return 'UNKNOWN';
    }
  }

  try {
    const out = await run('lpstat', ['-p', printerName]);
    if (out.includes('is idle')) return 'READY';
    if (out.includes('is processing') || out.includes('now printing')) return 'PRINTING';
    if (out.includes('disabled')) return 'ERROR';
    return 'UNKNOWN';
  } catch {
    return 'OFFLINE';
  }
}

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PrintJob, PrinterStatusResult } from '../types';

function createTempFile(content: string | Buffer, extension: string): string {
  const tempDir = os.tmpdir();
  const fileName = `elec_prnt_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
  const filePath = path.join(tempDir, fileName);
  
  if (typeof content === 'string' && content.startsWith('data:image')) {
    const base64Data = content.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  } else {
    fs.writeFileSync(filePath, content);
  }
  return filePath;
}

export function execCliPrint(job: PrintJob, printerName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    let filePath = '';

    try {
      if (job.type === 'image') filePath = createTempFile(job.data, 'jpg');
      else if (job.type === 'pdf') {
        filePath = fs.existsSync(job.data.toString()) ? job.data.toString() : createTempFile(job.data, 'pdf');
      } else if (job.type === 'html') filePath = createTempFile(job.data, 'html');
    } catch (err) {
      return reject(new Error(`Gagal menyiapkan file cetak: ${err}`));
    }

    if (isWindows) {
      let command = '';
      if (job.type === 'raw') {
        const cleanRaw = job.data.toString().replace(/"/g, '`"');
        command = `powershell -Command "Out-Printer -Name \\"${printerName}\\" -InputObject \\"${cleanRaw}\\""`;
      } else {
        command = `powershell -Command "Start-Process -FilePath \\"${filePath}\\" -ArgumentList \\"/p\\", \\"${printerName}\\" -WindowStyle Hidden -ErrorAction Stop"`;
      }

      exec(command, (error) => {
        setTimeout(() => { 
          if (job.type !== 'pdf' || !fs.existsSync(job.data.toString())) {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }, 5000);

        if (error) return reject(new Error(`PowerShell Error: ${error.message}`));
        resolve(true);
      });
    } else {
      let command = job.type === 'raw' ? `echo "${job.data}" | lp -d "${printerName}" -o raw` : `lp -d "${printerName}" "${filePath}"`;
      exec(command, (error) => {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (error) return reject(new Error(`CUPS Error: ${error.message}`));
        resolve(true);
      });
    }
  });
}

export function getPrinterStatus(printerName: string): Promise<PrinterStatusResult> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const cmd = `powershell -Command "Get-CimInstance Win32_Printer -Filter \\"Name='${printerName}'\\" | Select-Object PrinterStatus, DetectedErrorState, WorkOffline"`;
      exec(cmd, (err, stdout) => {
        if (err || !stdout.trim()) return resolve('UNKNOWN');
        if (stdout.includes('True')) return resolve('OFFLINE');
        if (stdout.includes('3')) return resolve('READY');
        if (stdout.includes('4')) return resolve('PRINTING');
        return resolve('READY');
      });
    } else {
      exec(`lpstat -p "${printerName}"`, (err, stdout) => {
        if (err) return resolve('OFFLINE');
        if (stdout.includes('is idle')) return resolve('READY');
        if (stdout.includes('is processing')) return resolve('PRINTING');
        if (stdout.includes('disabled')) return resolve('ERROR');
        return resolve('UNKNOWN');
      });
    }
  });
}
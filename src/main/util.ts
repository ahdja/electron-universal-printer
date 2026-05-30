import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Run a binary with an argument array. No shell is involved, so values in
 * `args` are passed verbatim and cannot be interpreted as shell syntax.
 */
export function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

/**
 * Run a fixed PowerShell script, passing user-controlled values through the
 * child's ENVIRONMENT (not the command line).
 *
 * `powershell -Command "<script>"` does NOT bind trailing arguments to $args
 * the way `-File` does — it appends them to the command text where they are
 * re-tokenized as PowerShell code. So the script must be a constant with no
 * interpolation, and every dynamic value is read inside the script via
 * `$env:NAME`. Environment values are inert string data and can never be
 * parsed as code, which closes the injection surface entirely.
 */
export function runPwsh(script: string, vars: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, maxBuffer: 1024 * 1024, env: { ...process.env, ...vars } },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      },
    );
  });
}

/**
 * Run a binary with an argument array and feed `input` to its stdin.
 * Used for raw printing (e.g. piping bytes to `lp -o raw`) without a shell.
 */
export function runWithInput(cmd: string, args: string[], input: string | Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`));
    });
    child.stdin.on('error', () => { /* ignore EPIPE if process died */ });
    child.stdin.end(input);
  });
}

/** Decode a base64 data-URL (or raw base64) into a Buffer. */
export function decodeDataUrl(data: string): Buffer {
  const base64 = data.replace(/^data:[^;,]+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/** Cryptographically-random, collision-free temp file written atomically. */
export function createTempFile(content: string | Buffer, extension: string): string {
  const fileName = `elec_prnt_${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(os.tmpdir(), fileName);
  const buffer =
    typeof content === 'string' && content.startsWith('data:')
      ? decodeDataUrl(content)
      : content;
  fs.writeFileSync(filePath, buffer, { mode: 0o600, flag: 'wx' });
  return filePath;
}

/** Strip anything that could escape a directory or break a filename. */
export function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_') || 'default';
}

/**
 * Join `segment` under `base` and assert the result stays inside `base`.
 * Defends against `..` / absolute-path traversal in attacker-controlled input.
 */
export function safeJoin(base: string, ...segments: string[]): string {
  const target = path.resolve(base, ...segments);
  const root = path.resolve(base);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Path traversal blocked: ${segments.join('/')} escapes ${base}`);
  }
  return target;
}

# @kotaksurat/electron-universal-printer

Universal printer adapter for **ElectronJS**. Handles standard OS drivers (Windows PowerShell, macOS/Linux CUPS) **and** dynamic hotfolders (DNP photo printers) behind one consistent API.

- 🖨️ **Two printer modes** — `driver` (OS print spooler) and `hotfolder` (drop-a-file printers like DNP).
- 📄 **Multiple input types** — `html`, `image` (base64 / data-URL), `pdf`, and `raw` (ESC/POS text).
- 🧵 **Built-in serial queue** — jobs run one at a time with a 500ms gap to avoid spooler collisions.
- 📡 **Live status** — query printer state (`READY` / `PRINTING` / `OFFLINE` / `ERROR` / `UNKNOWN`) plus pending queue count.
- 🔌 **3-layer split** — clean `main` / `preload` / `renderer` entry points, contextIsolation-safe.
- 🪟🐧🍎 **Cross-platform** — Windows (PowerShell), macOS & Linux (CUPS `lp` / `lpstat`).

> License: MIT · Peer dependency: `electron >= 20`

---

## Install

```bash
npm install @kotaksurat/electron-universal-printer
```

Build the package (consumers of the published package can skip this — `dist/` ships prebuilt):

```bash
npm run build      # rollup -> dist/ (cjs + esm + .d.ts)
npm run dev        # watch mode
```

---

## Architecture

Library has three entry points, one per Electron process layer:

| Import | Process | Role |
|--------|---------|------|
| `@kotaksurat/electron-universal-printer`          | **main**     | `registerElectronPrinter(ipcMain, configs)` — registers IPC handlers, runs the print queue. |
| `@kotaksurat/electron-universal-printer/preload`  | **preload**  | `getPrinterPreloadAPI(ipcRenderer)` — safe bridge object to expose via `contextBridge`. |
| `@kotaksurat/electron-universal-printer/renderer` | **renderer** | `electronPrinter` — typed wrapper around `window.electronPrinter`. |

Flow:

```
renderer (electronPrinter.print)
   → preload (contextBridge → ipcRenderer.invoke)
      → main (ipcMain.handle → printQueue.enqueue)
         → core (driver: CLI exec  |  hotfolder: write file)
```

---

## Usage

### 1. Main process

```js
const { app, ipcMain } = require('electron');
const { registerElectronPrinter } = require('@kotaksurat/electron-universal-printer');

app.whenReady().then(() => {
  registerElectronPrinter(ipcMain, [
    // Optional pre-registered printers. Leave [] to resolve dynamically from the OS list.
    { id: 'receipt',  type: 'driver',   name: 'EPSON TM-T20' },
    { id: 'dnp-photo', type: 'hotfolder', sizes: { '4x6': 'PR1', '5x7': 'PR2' } },
  ]);
});
```

Printers not pre-registered are resolved on the fly: a job to `printerId: 'HOTFOLDER'` is treated as hotfolder, anything else as a driver.

### 2. Preload script

```js
const { contextBridge, ipcRenderer } = require('electron');
const { getPrinterPreloadAPI } = require('@kotaksurat/electron-universal-printer/preload');

contextBridge.exposeInMainWorld('electronPrinter', getPrinterPreloadAPI(ipcRenderer));
```

> Requires `contextIsolation: true`, `nodeIntegration: false` (recommended Electron defaults).
>
> Because this preload `require()`s the package from `node_modules`, Electron's default sandbox (≥20) will block it with `module not found`. Either set `sandbox: false` in `webPreferences`, or bundle your preload (e.g. with esbuild/Vite) so it needs no runtime `require()`.

### 3. Renderer

```js
import electronPrinter from '@kotaksurat/electron-universal-printer/renderer';

// List OS printers
const printers = await electronPrinter.getPrinters();
// → [{ name, isDefault, status }]

// Print HTML to a driver printer
await electronPrinter.print('receipt', {
  type: 'html',
  data: '<h1>Hello</h1>',
});

// Print a base64 image to a DNP hotfolder
await electronPrinter.print('HOTFOLDER', {
  type: 'image',
  data: 'data:image/jpeg;base64,/9j/4AAQ...',
  options: { hotfolderPath: 'C:\\DNP\\Hotfolder', size: '4x6' },
});

// Send raw ESC/POS to a receipt printer
await electronPrinter.print('receipt', { type: 'raw', data: '\x1B@Hello\n\x1DV\x00' });

// Status + queue depth
const { status, queueCount } = await electronPrinter.getStatus('receipt', 'driver');
```

---

## API

### `registerElectronPrinter(ipcMain, configs)` — main

Registers three IPC handlers and seeds the printer registry.

| IPC channel | Returns |
|-------------|---------|
| `gvs-printer:list`   | `Array<{ name, isDefault, status }>` |
| `gvs-printer:print`  | `boolean` (queued + resolved) |
| `gvs-printer:status` | `{ status, queueCount }` |

### `getPrinterPreloadAPI(ipcRenderer)` — preload

Returns `{ getPrinters, print, getStatus }`, each forwarding to the matching IPC channel.

### `electronPrinter` — renderer

| Method | Signature |
|--------|-----------|
| `getPrinters()` | `Promise<any[]>` |
| `print(printerId, payload)` | `Promise<boolean>` |
| `getStatus(printerId, type, hotfolderPath?)` | `Promise<PrinterStatusPayload>` |

---

## Types

```ts
type PrinterType = 'driver' | 'hotfolder';
type InputType   = 'html' | 'image' | 'pdf' | 'raw';
type PrinterStatusResult = 'READY' | 'PRINTING' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';

interface PrinterConfig {
  id: string;
  type: PrinterType;
  name?: string;                  // OS driver name (defaults to id)
  hotfolderPath?: string;         // default hotfolder path for this printer
  sizes?: { [size: string]: string };  // size key → subfolder written under hotfolderPath
}

interface PrintJobOptions {
  size?: string;                  // hotfolder size key (looked up in PrinterConfig.sizes)
  hotfolderPath?: string;         // overrides PrinterConfig.hotfolderPath (REQUIRED if none set)
}

interface PrintJob {
  printerId: string;
  type: InputType;
  data: string | Buffer;          // markup / data-URL / file path / raw text
  options?: PrintJobOptions;
}

interface PrinterStatusPayload {
  status: PrinterStatusResult;
  queueCount: number;
}
```

---

## How each mode works

**Driver mode** (`type: 'driver'`)
- `image` / `html` / `pdf` written to a temp file, then printed via the OS.
  - **Windows** — `Start-Process -Verb PrintTo` (PowerShell, hidden window) targeting the named printer. `raw` uses `Out-Printer`.
  - **macOS / Linux** — `lp -d <printer> <file>`. `raw` pipes bytes to `lp -o raw` via stdin.
- All OS calls use `execFile`/`spawn` with **argument arrays — never a shell**. On Windows, user values reach PowerShell via the child's **environment** (`$env:EUP_*`), not the command line, so a printer name or payload can never be parsed as PowerShell/shell code.
- Temp files use crypto-random names, mode `0600`, and are removed after printing. Existing PDF paths are printed in place, not deleted.

**Hotfolder mode** (`type: 'hotfolder'`)
- Decodes the base64 image and writes `print_<size>_<timestamp>_<uuid>.jpg` into the hotfolder.
- `options.size` is resolved through `config.sizes` to a **sanitized subfolder** under the hotfolder; `..`/absolute paths are blocked (no traversal).
- Target folder is created if missing. A hotfolder path is **required** (`options.hotfolderPath` or `config.hotfolderPath`) — omitting it throws.
- The DNP (or other) watcher service picks the file up and prints it.

**Queue** — every job goes through a single serial queue (`printQueue`). One job runs at a time, with a 500ms pause between jobs to keep spoolers from overlapping. `getQueueLength()` backs the `queueCount` in status responses.

---

## Local test app

A minimal Electron harness lives in [`test-app/`](./test-app):

```bash
npm run build
npx electron test-app/main.js
```

It loads the built `dist/`, exposes the preload API, and prints to your live OS printers.

---

## Security model

The IPC handlers run in the **main process** and act on data sent by the renderer. Hardening in place:

- **No command injection** — `execFile`/`spawn` with arg arrays; Windows passes user values through the child environment (`$env:EUP_*`), never the command line.
- **No path traversal** — hotfolder size keys are sanitized (`[^A-Za-z0-9_-]→_`) and every path is `safeJoin`-confined under its base.
- **Trusted hotfolder root** — a registered printer's `hotfolderPath` takes precedence and **cannot be overridden** by the renderer; only fully-dynamic (unregistered) printers use the renderer-supplied path.
- **DoS caps** — print payloads are limited to 64 MiB and the queue to 200 pending jobs.

**Your responsibility:** the renderer is trusted to the extent your app trusts its own page. Keep `contextIsolation: true` / `nodeIntegration: false`, do **not** load untrusted remote content into a window wired to these handlers, and sanitize any user HTML before printing it. For fully-dynamic printers, the renderer can choose the hotfolder path — register your printers up front to lock the write root.

## Notes & caveats

- Windows printer listing parses `Get-CimInstance … | ConvertTo-Json`; macOS/Linux parses `lpstat -p`. CUPS output is locale-sensitive, so status keywords may vary.
- `Start-Process -Verb PrintTo` depends on a print handler being registered for the file type (e.g. a PDF viewer for `.pdf`).
- On Windows, `raw` payloads pass via an environment variable (~32 KB practical limit). Large raw jobs should use `image`/`pdf` instead.

## License

MIT

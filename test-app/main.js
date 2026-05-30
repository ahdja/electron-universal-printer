const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// Import langsung dari folder dist hasil build kamu
const { registerElectronPrinter } = require('../dist/main/index.js'); 

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.openDevTools(); // Buka devtools untuk lihat console log
}

app.whenReady().then(() => {
  // Jalankan printer manager bawaan package kamu
  // Di sini kita tidak hardcode printer driver, karena tipenya dinamis / pakai list OS
  registerElectronPrinter(ipcMain, []); 

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
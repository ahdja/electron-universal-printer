const { contextBridge, ipcRenderer } = require('electron');
const { getPrinterPreloadAPI } = require('../dist/preload/index.js');

// Ekspos API ke window
contextBridge.exposeInMainWorld('electronPrinter', getPrinterPreloadAPI(ipcRenderer));
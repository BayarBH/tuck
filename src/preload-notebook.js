'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notebook', {
  get: () => ipcRenderer.invoke('notes:get'),
  onChange: (cb) => ipcRenderer.on('notes:changed', () => cb()),
  copy: (text) => ipcRenderer.send('notes:copy', text),
  openFile: () => ipcRenderer.send('notes:open-file'),
  openFolder: () => ipcRenderer.send('notes:open-folder'),
});

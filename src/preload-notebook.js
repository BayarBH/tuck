'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notebook', {
  get: () => ipcRenderer.invoke('notes:get'),
  onChange: (cb) => ipcRenderer.on('notes:changed', () => cb()),
  copy: (text) => ipcRenderer.send('notes:copy', text),
  openFile: () => ipcRenderer.send('notes:open-file'),
  openFolder: () => ipcRenderer.send('notes:open-folder'),
  update: (key, patch) => ipcRenderer.invoke('notes:update', key, patch),
  remove: (key) => ipcRenderer.invoke('notes:remove', key),
  undo: (token) => ipcRenderer.invoke('notes:undo', token),
  exportMarkdown: (title, keys) => ipcRenderer.invoke('notes:export-md', { title, keys }),
  exportPdf: (title) => ipcRenderer.invoke('notes:export-pdf', { title }),
  capture: (rect, action) => ipcRenderer.invoke('notes:capture', rect, action),
});

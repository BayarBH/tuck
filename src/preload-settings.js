'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tuckSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  pickFolder: () => ipcRenderer.invoke('settings:pick-folder'),
  listApps: () => ipcRenderer.invoke('settings:list-apps'),
  diagnostics: () => ipcRenderer.invoke('settings:diagnostics'),
  copy: (text) => ipcRenderer.send('settings:copy', text),
  openLog: () => ipcRenderer.send('settings:open-log'),
  openFolder: (which) => ipcRenderer.send('settings:open-folder', which),
  onChange: (cb) => ipcRenderer.on('settings:changed', (_e, all) => cb(all)),
  onSection: (cb) => ipcRenderer.on('settings:section', (_e, s) => cb(s)),
});

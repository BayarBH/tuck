'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('onboarding', {
  info: () => ipcRenderer.invoke('onboarding:info'),
  onCaptured: (cb) => ipcRenderer.on('onboarding:captured', (_e, mode) => cb(mode)),
  openNotebook: () => ipcRenderer.send('onboarding:open-notebook'),
  done: () => ipcRenderer.send('onboarding:done'),
});

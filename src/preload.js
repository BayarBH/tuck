'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// platform-<os> class on <html> drives the macOS layout tweaks (traffic lights, ⌘ labels)
window.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(`platform-${process.platform}`));

contextBridge.exposeInMainWorld('tuck', {
  platform: process.platform,
  onCapture: (cb) => ipcRenderer.on('capture', (_e, data) => cb(data)),
  onConfig: (cb) => ipcRenderer.on('config', (_e, data) => cb(data)),
  animDone: (id) => ipcRenderer.send('anim-done', id),
  submit: (id, thought) => ipcRenderer.send('submit', id, thought),
  cancel: (id) => ipcRenderer.send('cancel', id),
});

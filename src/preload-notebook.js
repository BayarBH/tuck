'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// platform-<os> class on <html> drives the macOS layout tweaks (traffic lights, ⌘ labels)
window.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(`platform-${process.platform}`));

contextBridge.exposeInMainWorld('notebook', {
  platform: process.platform,
  get: () => ipcRenderer.invoke('notes:get'),
  onChange: (cb) => ipcRenderer.on('notes:changed', () => cb()),
  copy: (text) => ipcRenderer.send('notes:copy', text),
  openFile: () => ipcRenderer.send('notes:open-file'),
  openLink: (url) => ipcRenderer.send('notes:open-link', url),
  openObsidian: () => ipcRenderer.send('notes:open-obsidian'),
  update: (key, patch) => ipcRenderer.invoke('notes:update', key, patch),
  remove: (key) => ipcRenderer.invoke('notes:remove', key),
  undo: (token) => ipcRenderer.invoke('notes:undo', token),
  exportMarkdown: (title, keys) => ipcRenderer.invoke('notes:export-md', { title, keys }),
  exportPdf: (title) => ipcRenderer.invoke('notes:export-pdf', { title }),
  capture: (rect, action) => ipcRenderer.invoke('notes:capture', rect, action),
});

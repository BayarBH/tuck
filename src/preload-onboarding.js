'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// platform-<os> class on <html> drives the macOS layout tweaks (traffic lights, ⌘ labels)
window.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(`platform-${process.platform}`));

contextBridge.exposeInMainWorld('onboarding', {
  platform: process.platform,
  info: () => ipcRenderer.invoke('onboarding:info'),
  onCaptured: (cb) => ipcRenderer.on('onboarding:captured', (_e, mode) => cb(mode)),
  openNotebook: () => ipcRenderer.send('onboarding:open-notebook'),
  done: () => ipcRenderer.send('onboarding:done'),
  // macOS Accessibility permission (Windows: always granted)
  permission: () => ipcRenderer.invoke('onboarding:permission'),
  onPermission: (cb) => ipcRenderer.on('onboarding:permission-changed', (_e, trusted) => cb(trusted)),
  grant: () => ipcRenderer.send('onboarding:grant'),
});

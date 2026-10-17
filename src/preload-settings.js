'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// platform-<os> class on <html> drives the macOS layout tweaks (traffic lights, ⌘ labels)
window.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(`platform-${process.platform}`));

contextBridge.exposeInMainWorld('tuckSettings', {
  platform: process.platform,
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  pickFolder: () => ipcRenderer.invoke('settings:pick-folder'),
  vaults: () => ipcRenderer.invoke('settings:vaults'),
  useVault: (vaultPath) => ipcRenderer.invoke('settings:use-vault', vaultPath),
  openObsidian: () => ipcRenderer.send('settings:open-obsidian'),
  listApps: () => ipcRenderer.invoke('settings:list-apps'),
  diagnostics: () => ipcRenderer.invoke('settings:diagnostics'),
  copy: (text) => ipcRenderer.send('settings:copy', text),
  openLog: () => ipcRenderer.send('settings:open-log'),
  openFolder: (which) => ipcRenderer.send('settings:open-folder', which),
  onChange: (cb) => ipcRenderer.on('settings:changed', (_e, all) => cb(all)),
  permissions: () => ipcRenderer.invoke('settings:permissions'),
  openPermissions: () => ipcRenderer.send('settings:open-permissions'),
  onPermissions: (cb) => ipcRenderer.on('settings:permissions-changed', (_e, trusted) => cb(trusted)),
  onSection: (cb) => ipcRenderer.on('settings:section', (_e, s) => cb(s)),
});

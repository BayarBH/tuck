'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zhailu', {
  onCapture: (cb) => ipcRenderer.on('capture', (_e, data) => cb(data)),
  onConfig: (cb) => ipcRenderer.on('config', (_e, data) => cb(data)),
  animDone: (id) => ipcRenderer.send('anim-done', id),
  submit: (id, thought) => ipcRenderer.send('submit', id, thought),
  cancel: (id) => ipcRenderer.send('cancel', id),
});

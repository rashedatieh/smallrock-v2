const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onUpdate: (cb) => ipcRenderer.on('overlay:update', (_event, data) => cb(data)),
});

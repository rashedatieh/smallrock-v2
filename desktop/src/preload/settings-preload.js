const { contextBridge, ipcRenderer } = require('electron');

// Minimal, bounded bridge. The renderer can read/write only allowlisted store
// keys (enforced again in main), set the API key through an encrypted channel,
// and check whether a key exists — it can never read the key back in plaintext.
contextBridge.exposeInMainWorld('smallrock', {
  getAll:    ()             => ipcRenderer.invoke('store:getAll'),
  get:       (key)          => ipcRenderer.invoke('store:get', key),
  set:       (key, value)   => ipcRenderer.invoke('store:set', key, value),
  setKey:    (value)        => ipcRenderer.invoke('key:set', value),
  keyStatus: ()             => ipcRenderer.invoke('key:status'),
  testKey:   (text, modeId) => ipcRenderer.invoke('rewrite:test', { text, modeId }),
});

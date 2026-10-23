// Exposes a tiny socket API to the UI. The sockets themselves live in the
// main process (see net.js) because the renderer is sandboxed.
const { contextBridge, ipcRenderer } = require('electron');

// Key-value storage on disk. localStorage batches writes and loses recent
// changes if the app is killed mid-round; these are written immediately.
contextBridge.exposeInMainWorld('debateStore', {
  get: (key) => ipcRenderer.invoke('store:get', key),
  set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  remove: (key) => ipcRenderer.invoke('store:remove', key),
});

// Offline Whisper in the main process (whisper.js).
contextBridge.exposeInMainWorld('debateWhisper', {
  status: () => ipcRenderer.invoke('whisper:status'),
  prepare: (jobId, model) => ipcRenderer.invoke('whisper:prepare', jobId, model),
  transcribe: (jobId, model, pcm) => ipcRenderer.invoke('whisper:transcribe', jobId, model, pcm),
  deleteModel: (model) => ipcRenderer.invoke('whisper:delete', model),
  onProgress: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('whisper:progress', handler);
    return () => ipcRenderer.removeListener('whisper:progress', handler);
  },
});

contextBridge.exposeInMainWorld('debateFiles', {
  // Writes a clip to disk and returns an app:// URL that plays it.
  saveClip: (fileName, base64) => ipcRenderer.invoke('files:saveClip', fileName, base64),
});

contextBridge.exposeInMainWorld('debateNet', {
  listen: (port) => ipcRenderer.invoke('net:listen', port),
  unlisten: () => ipcRenderer.invoke('net:unlisten'),
  connect: (host, port, timeoutMs) => ipcRenderer.invoke('net:connect', host, port, timeoutMs),
  write: (id, data) => ipcRenderer.send('net:write', id, data),
  end: (id) => ipcRenderer.send('net:end', id),
  destroy: (id) => ipcRenderer.send('net:destroy', id),
  addresses: () => ipcRenderer.invoke('net:addresses'),
  onEvent: (cb) => {
    const handler = (_e, event) => cb(event);
    ipcRenderer.on('net:event', handler);
    return () => ipcRenderer.removeListener('net:event', handler);
  },
});

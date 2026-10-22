// Exposes a tiny socket API to the UI. The sockets themselves live in the
// main process (see net.js) because the renderer is sandboxed.
const { contextBridge, ipcRenderer } = require('electron');

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

/* The small bridge the Ossi TV page may use on Windows: version, updates, open a link. */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('OssiDesk', {
  version: ipcRenderer.sendSync('ossi:version'),
  check: (manual) => ipcRenderer.send('ossi:check', !!manual),
  download: () => ipcRenderer.send('ossi:download'),
  openUrl: (url) => ipcRenderer.send('ossi:open', String(url || ''))
});

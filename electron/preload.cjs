const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Filesystem
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanDirectory: (folderPath) => ipcRenderer.invoke('fs:scanDirectory', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  countSTLFiles: (folderPath) => ipcRenderer.invoke('fs:countSTLFiles', folderPath),

  // Database
  db: {
    getAllFiles: () => ipcRenderer.invoke('db:getAllFiles'),
    saveFile: (data) => ipcRenderer.invoke('db:saveFile', data),
    updateFile: (id, updates) => ipcRenderer.invoke('db:updateFile', id, updates),
    deleteFile: (id) => ipcRenderer.invoke('db:deleteFile', id),
    savePendingFile: (data) => ipcRenderer.invoke('db:savePendingFile', data),
    confirmPendingFiles: (ids) => ipcRenderer.invoke('db:confirmPendingFiles', ids),
    cancelPendingFiles: () => ipcRenderer.invoke('db:cancelPendingFiles'),
    getAllDirectories: () => ipcRenderer.invoke('db:getAllDirectories'),
    saveDirectory: (data) => ipcRenderer.invoke('db:saveDirectory', data),
    deleteDirectory: (id) => ipcRenderer.invoke('db:deleteDirectory', id),
  },
});

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
    cancelPendingFiles: (sessionIds) => ipcRenderer.invoke('db:cancelPendingFiles', sessionIds),
    getAllDirectories: () => ipcRenderer.invoke('db:getAllDirectories'),
    saveDirectory: (data) => ipcRenderer.invoke('db:saveDirectory', data),
    deleteDirectory: (id) => ipcRenderer.invoke('db:deleteDirectory', id),
    getCategoryValues: (fileId) => ipcRenderer.invoke('db:getCategoryValues', fileId),
    setCategoryValues: (fileId, values) => ipcRenderer.invoke('db:setCategoryValues', fileId, values),
    bulkSetCategoryValue: (fileIds, categoryId, value) => ipcRenderer.invoke('db:bulkSetCategoryValue', fileIds, categoryId, value),
    bulkSetCategoryValues: (entries) => ipcRenderer.invoke('db:bulkSetCategoryValues', entries),
    getAllScenes: () => ipcRenderer.invoke('db:getAllScenes'),
    getScene: (id) => ipcRenderer.invoke('db:getScene', id),
    saveScene: (data) => ipcRenderer.invoke('db:saveScene', data),
    saveSceneObjects: (sceneId, objects) => ipcRenderer.invoke('db:saveSceneObjects', sceneId, objects),
    deleteScene: (id) => ipcRenderer.invoke('db:deleteScene', id),
  },
});

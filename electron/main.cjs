const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database.cjs');
const { scanDirectory, readFile, countSTLFiles } = require('./filesystem.cjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Database IPC handlers ──
ipcMain.handle('db:getAllFiles', () => db.getAllFiles());
ipcMain.handle('db:saveFile', (_, data) => db.saveFile(data));
ipcMain.handle('db:updateFile', (_, id, updates) => db.updateFile(id, updates));
ipcMain.handle('db:deleteFile', (_, id) => db.deleteFile(id));
ipcMain.handle('db:savePendingFile', (_, data) => db.savePendingFile(data));
ipcMain.handle('db:confirmPendingFiles', (_, ids) => db.confirmPendingFiles(ids));
ipcMain.handle('db:cancelPendingFiles', (_, sessionIds) => db.cancelPendingFiles(sessionIds));
ipcMain.handle('db:getAllDirectories', () => db.getAllDirectories());
ipcMain.handle('db:saveDirectory', (_, data) => db.saveDirectory(data));
ipcMain.handle('db:deleteDirectory', (_, id) => db.deleteDirectory(id));
ipcMain.handle('db:getCategoryValues', (_, fileId) => db.getCategoryValues(fileId));
ipcMain.handle('db:setCategoryValues', (_, fileId, values) => db.setCategoryValues(fileId, values));
ipcMain.handle('db:bulkSetCategoryValue', (_, fileIds, categoryId, value) => db.bulkSetCategoryValue(fileIds, categoryId, value));
ipcMain.handle('db:bulkSetCategoryValues', (_, entries) => db.bulkSetCategoryValues(entries));

// ── Filesystem IPC handlers ──
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:scanDirectory', (_, folderPath) => scanDirectory(folderPath));
ipcMain.handle('fs:readFile', (_, filePath) => readFile(filePath));
ipcMain.handle('fs:countSTLFiles', (_, folderPath) => countSTLFiles(folderPath));

// ── Scene IPC handlers ──
ipcMain.handle('db:getAllScenes', () => db.getAllScenes());
ipcMain.handle('db:getScene', (_, id) => db.getScene(id));
ipcMain.handle('db:saveScene', (_, data) => db.saveScene(data));
ipcMain.handle('db:saveSceneObjects', (_, sceneId, objects) => db.saveSceneObjects(sceneId, objects));
ipcMain.handle('db:deleteScene', (_, id) => db.deleteScene(id));

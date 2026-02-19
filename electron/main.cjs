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
ipcMain.handle('db:cancelPendingFiles', () => db.cancelPendingFiles());
ipcMain.handle('db:getAllDirectories', () => db.getAllDirectories());
ipcMain.handle('db:saveDirectory', (_, data) => db.saveDirectory(data));
ipcMain.handle('db:deleteDirectory', (_, id) => db.deleteDirectory(id));

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

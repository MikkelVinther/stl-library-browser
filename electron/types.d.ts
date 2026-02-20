/**
 * Describes the IPC contract exposed by the Electron preload script.
 * `window.electronAPI` is only defined inside the Electron renderer process.
 */

import type { STLFile, DirectoryEntry, CategoryValues } from '../src/types/index';

interface ElectronDB {
  getAllFiles: () => Promise<STLFile[]>;
  saveFile: (data: Partial<STLFile>) => Promise<void>;
  updateFile: (id: string, updates: Partial<STLFile>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  savePendingFile: (data: Partial<STLFile>) => Promise<void>;
  confirmPendingFiles: (ids: string[]) => Promise<void>;
  cancelPendingFiles: () => Promise<void>;
  getAllDirectories: () => Promise<DirectoryEntry[]>;
  saveDirectory: (data: DirectoryEntry) => Promise<DirectoryEntry>;
  deleteDirectory: (id: string) => Promise<void>;
  getCategoryValues: (fileId: string) => Promise<CategoryValues>;
  setCategoryValues: (fileId: string, values: CategoryValues) => Promise<void>;
  bulkSetCategoryValue: (fileIds: string[], categoryId: string, value: string) => Promise<void>;
  bulkSetCategoryValues: (entries: Array<{ fileId: string; categories: CategoryValues }>) => Promise<void>;
}

interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  scanDirectory: (folderPath: string) => Promise<import('../src/types/index').FileInfo[]>;
  readFile: (filePath: string) => Promise<ArrayBuffer | null>;
  countSTLFiles: (folderPath: string) => Promise<number>;
  db: ElectronDB;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

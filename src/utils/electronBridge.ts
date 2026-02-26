import type { STLFile, DirectoryEntry, CategoryValues, FileInfo } from '../types/index';
import type { SceneMeta, SceneObjectData } from '../types/scene';

/**
 * Returns window.electronAPI, throwing a descriptive error if it isn't defined.
 * This happens when the code runs outside Electron's renderer process (e.g. unit tests,
 * a plain browser). Phase 5 fix: replaces the silent `api!` non-null assertion.
 */
function getAPI() {
  const api = window.electronAPI;
  if (!api) {
    throw new Error(
      'window.electronAPI is not defined. ' +
      'Is this running inside Electron with the preload script loaded?'
    );
  }
  return api;
}

// Filesystem
export const openFolder = (): Promise<string | null> => {
  try { return getAPI().openFolder(); }
  catch (e) { console.error('[electronBridge] openFolder failed:', e); return Promise.resolve(null); }
};
export const scanDirectory = (path: string): Promise<FileInfo[]> => {
  try { return getAPI().scanDirectory(path); }
  catch (e) { console.error('[electronBridge] scanDirectory failed:', e); return Promise.resolve([]); }
};
export const readFile = (path: string): Promise<ArrayBuffer | null> => {
  try { return getAPI().readFile(path); }
  catch (e) { console.error('[electronBridge] readFile failed:', e); return Promise.resolve(null); }
};
export const countSTLFiles = (path: string): Promise<number> => {
  try { return getAPI().countSTLFiles(path); }
  catch (e) { console.error('[electronBridge] countSTLFiles failed:', e); return Promise.resolve(0); }
};

// Database
export const getAllFiles = (): Promise<STLFile[]> => {
  try { return getAPI().db.getAllFiles(); }
  catch (e) { console.error('[electronBridge] getAllFiles failed:', e); return Promise.resolve([]); }
};
export const saveFile = (data: Partial<STLFile>): Promise<void> => {
  try { return getAPI().db.saveFile(data); }
  catch (e) { console.error('[electronBridge] saveFile failed:', e); return Promise.resolve(); }
};
export const updateFile = (id: string, updates: Partial<STLFile>): Promise<void> => {
  try { return getAPI().db.updateFile(id, updates); }
  catch (e) { console.error('[electronBridge] updateFile failed:', e); return Promise.resolve(); }
};
export const deleteFile = (id: string): Promise<void> => {
  try { return getAPI().db.deleteFile(id); }
  catch (e) { console.error('[electronBridge] deleteFile failed:', e); return Promise.resolve(); }
};
/** Returns the canonical DB id for the saved row (may differ from data.id on re-import). */
export const savePendingFile = (data: Partial<STLFile>): Promise<string> => {
  try { return getAPI().db.savePendingFile(data); }
  catch (e) { console.error('[electronBridge] savePendingFile failed:', e); return Promise.resolve(data.id ?? ''); }
};
export const confirmPendingFiles = (ids: string[]): Promise<void> => {
  try { return getAPI().db.confirmPendingFiles(ids); }
  catch (e) { console.error('[electronBridge] confirmPendingFiles failed:', e); return Promise.resolve(); }
};
/** Delete pending files. Pass sessionIds to scope the delete to this import session only. */
export const cancelPendingFiles = (sessionIds?: string[]): Promise<void> => {
  try { return getAPI().db.cancelPendingFiles(sessionIds); }
  catch (e) { console.error('[electronBridge] cancelPendingFiles failed:', e); return Promise.resolve(); }
};
export const getAllDirectories = (): Promise<DirectoryEntry[]> => {
  try { return getAPI().db.getAllDirectories(); }
  catch (e) { console.error('[electronBridge] getAllDirectories failed:', e); return Promise.resolve([]); }
};
export const saveDirectory = (data: DirectoryEntry): Promise<DirectoryEntry> => {
  try { return getAPI().db.saveDirectory(data); }
  catch (e) { console.error('[electronBridge] saveDirectory failed:', e); return Promise.resolve(data); }
};
export const deleteDirectory = (id: string): Promise<void> => {
  try { return getAPI().db.deleteDirectory(id); }
  catch (e) { console.error('[electronBridge] deleteDirectory failed:', e); return Promise.resolve(); }
};
export const getCategoryValues = (fileId: string): Promise<CategoryValues> => {
  try { return getAPI().db.getCategoryValues(fileId); }
  catch (e) { console.error('[electronBridge] getCategoryValues failed:', e); return Promise.resolve({}); }
};
export const setCategoryValues = (fileId: string, values: CategoryValues): Promise<void> => {
  try { return getAPI().db.setCategoryValues(fileId, values); }
  catch (e) { console.error('[electronBridge] setCategoryValues failed:', e); return Promise.resolve(); }
};
export const bulkSetCategoryValue = (fileIds: string[], categoryId: string, value: string): Promise<void> => {
  try { return getAPI().db.bulkSetCategoryValue(fileIds, categoryId, value); }
  catch (e) { console.error('[electronBridge] bulkSetCategoryValue failed:', e); return Promise.resolve(); }
};
export const bulkSetCategoryValues = (entries: Array<{ fileId: string; categories: CategoryValues }>): Promise<void> => {
  try { return getAPI().db.bulkSetCategoryValues(entries); }
  catch (e) { console.error('[electronBridge] bulkSetCategoryValues failed:', e); return Promise.resolve(); }
};

// Scene CRUD
export const getAllScenes = (): Promise<SceneMeta[]> => {
  try { return getAPI().db.getAllScenes(); }
  catch (e) { console.error('[electronBridge] getAllScenes failed:', e); return Promise.resolve([]); }
};
export const getScene = (id: string): Promise<(SceneMeta & { objects: SceneObjectData[] }) | null> => {
  try { return getAPI().db.getScene(id); }
  catch (e) { console.error('[electronBridge] getScene failed:', e); return Promise.resolve(null); }
};
export const saveScene = (data: Partial<SceneMeta> & { id: string; name: string }): Promise<void> => {
  try { return getAPI().db.saveScene(data); }
  catch (e) { console.error('[electronBridge] saveScene failed:', e); return Promise.resolve(); }
};
export const saveSceneObjects = (sceneId: string, objects: SceneObjectData[]): Promise<void> => {
  try { return getAPI().db.saveSceneObjects(sceneId, objects); }
  catch (e) { console.error('[electronBridge] saveSceneObjects failed:', e); return Promise.resolve(); }
};
export const deleteScene = (id: string): Promise<void> => {
  try { return getAPI().db.deleteScene(id); }
  catch (e) { console.error('[electronBridge] deleteScene failed:', e); return Promise.resolve(); }
};

const api = window.electronAPI;

// Filesystem
export const openFolder = () => api.openFolder();
export const scanDirectory = (path) => api.scanDirectory(path);
export const readFile = (path) => api.readFile(path);
export const countSTLFiles = (path) => api.countSTLFiles(path);

// Database — same signatures as old db.js
export const getAllFiles = () => api.db.getAllFiles();
export const saveFile = (data) => api.db.saveFile(data);
export const updateFile = (id, updates) => api.db.updateFile(id, updates);
export const deleteFile = (id) => api.db.deleteFile(id);
export const savePendingFile = (data) => api.db.savePendingFile(data);
export const confirmPendingFiles = (ids) => api.db.confirmPendingFiles(ids);
export const cancelPendingFiles = () => api.db.cancelPendingFiles();
export const getAllDirectories = () => api.db.getAllDirectories();
export const saveDirectory = (data) => api.db.saveDirectory(data);
export const deleteDirectory = (id) => api.db.deleteDirectory(id);
export const getCategoryValues = (fileId) => api.db.getCategoryValues(fileId);
export const setCategoryValues = (fileId, values) => api.db.setCategoryValues(fileId, values);
export const bulkSetCategoryValue = (fileIds, categoryId, value) => api.db.bulkSetCategoryValue(fileIds, categoryId, value);
export const bulkSetCategoryValues = (entries) => api.db.bulkSetCategoryValues(entries);

/**
 * Documents the behavior of electronBridge when window.electronAPI
 * is undefined (i.e., outside of Electron's preload context).
 *
 * Phase 5 fix: getAPI() throws a descriptive Error (not a raw TypeError),
 * and each exported function catches it and returns a sensible default.
 */
import {
  openFolder,
  getAllFiles,
  scanDirectory,
  readFile,
  countSTLFiles,
} from '../electronBridge.js';

describe('electronBridge without Electron (window.electronAPI undefined)', () => {
  it('window.electronAPI is undefined in this test environment', () => {
    expect(window.electronAPI).toBeUndefined();
  });

  it('importing electronBridge does NOT throw at import time', () => {
    // getAPI() is lazy — called only when a function is invoked
    expect(typeof openFolder).toBe('function');
    expect(typeof getAllFiles).toBe('function');
  });

  it('openFolder() resolves to null when API is unavailable', async () => {
    const result = await openFolder();
    expect(result).toBeNull();
  });

  it('getAllFiles() resolves to empty array when API is unavailable', async () => {
    const result = await getAllFiles();
    expect(result).toEqual([]);
  });

  it('scanDirectory() resolves to empty array when API is unavailable', async () => {
    const result = await scanDirectory('/some/path');
    expect(result).toEqual([]);
  });

  it('readFile() resolves to null when API is unavailable', async () => {
    const result = await readFile('/some/file.stl');
    expect(result).toBeNull();
  });

  it('countSTLFiles() resolves to 0 when API is unavailable', async () => {
    const result = await countSTLFiles('/some/path');
    expect(result).toBe(0);
  });
});

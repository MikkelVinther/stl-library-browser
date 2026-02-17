const DB_NAME = 'stl-library';
const DB_VERSION = 3;
const STORE_NAME = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFile(fileData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(fileData);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Returns only confirmed (or legacy pre-v3) files — excludes pending imports. */
export async function getAllFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const results = request.result.filter(
        (r) => !r.importStatus || r.importStatus === 'confirmed'
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateFile(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      store.put({ ...getReq.result, ...updates });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Save a file with importStatus: 'pending' */
export async function savePendingFile(fileData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...fileData, importStatus: 'pending' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Batch confirm: set importStatus to 'confirmed' for all given IDs in a single transaction. */
export async function confirmPendingFiles(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const id of ids) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, importStatus: 'confirmed' });
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete all records where importStatus === 'pending' in a single transaction. */
export async function cancelPendingFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      for (const record of request.result) {
        if (record.importStatus === 'pending') {
          store.delete(record.id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Returns all records with importStatus === 'pending'. */
export async function getPendingFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve(request.result.filter((r) => r.importStatus === 'pending'));
    };
    request.onerror = () => reject(request.error);
  });
}

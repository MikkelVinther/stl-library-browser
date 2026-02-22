import { useRef, useCallback } from 'react';
import type { BufferGeometry } from 'three';
import { loadSTLLoader } from '../utils/loadSTLLoader';
import { readFile } from '../utils/electronBridge';
import type { SceneObject, SceneState } from '../types/scene';

interface CacheEntry {
  promise: Promise<BufferGeometry> | null;
  geometry: BufferGeometry | null;
  refCount: number;
}

// Semaphore for limiting parallel geometry loads
function makeSemaphore(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = () => {
        running++;
        fn().then(resolve, reject).finally(() => {
          running--;
          if (queue.length > 0) queue.shift()!();
        });
      };
      if (running < concurrency) execute();
      else queue.push(execute);
    });
  };
}

const loadSemaphore = makeSemaphore(4);

export interface UseSceneObjectsReturn {
  addObject: (
    fileId: string,
    fileName: string,
    fileFullPath: string | null,
    fileThumbnail: string | null,
    sceneId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize?: number,
    gridEnabled?: boolean,
  ) => void;
  removeObject: (
    objectId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => void;
  duplicateObject: (
    objectId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize?: number,
  ) => void;
  updateTransform: (
    objectId: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale' | 'color'>>,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => void;
  selectObject: (
    objectId: string | null,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => void;
  loadGeometryForObject: (
    obj: SceneObject,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => void;
  disposeAll: () => void;
}

export function useSceneObjects(): UseSceneObjectsReturn {
  const cache = useRef<Map<string, CacheEntry>>(new Map());

  const loadGeometry = useCallback((fileId: string, filePath: string): Promise<BufferGeometry> => {
    const existing = cache.current.get(fileId);
    if (existing?.promise) return existing.promise;
    if (existing?.geometry) return Promise.resolve(existing.geometry);

    const promise = loadSemaphore(async () => {
      const { STLLoader } = await loadSTLLoader();
      const buffer = await readFile(filePath);
      if (!buffer) throw new Error(`readFile returned null for ${filePath}`);
      const loader = new STLLoader();
      const geo = loader.parse(buffer);
      geo.computeVertexNormals();
      geo.rotateX(-Math.PI / 2);
      return geo;
    });

    const entry = cache.current.get(fileId) ?? { promise: null, geometry: null, refCount: 0 };
    entry.promise = promise;
    cache.current.set(fileId, entry);

    promise.then((geo) => {
      const e = cache.current.get(fileId);
      if (e) { e.geometry = geo; e.promise = null; }
    }).catch(() => {
      const e = cache.current.get(fileId);
      if (e) e.promise = null;
    });

    return promise;
  }, []);

  const loadGeometryForObject = useCallback((
    obj: SceneObject,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    if (!obj.fileFullPath) return;
    const entry = cache.current.get(obj.fileId);
    if (entry?.geometry) {
      // Already cached — just update this object's geometry
      setScene((prev) => prev ? {
        ...prev,
        objects: prev.objects.map((o) =>
          o.id === obj.id ? { ...o, geometry: entry.geometry, loadStatus: 'loaded' } : o
        ),
      } : prev);
      return;
    }

    // Mark as loading
    setScene((prev) => prev ? {
      ...prev,
      objects: prev.objects.map((o) =>
        o.id === obj.id ? { ...o, loadStatus: 'loading' } : o
      ),
    } : prev);

    loadGeometry(obj.fileId, obj.fileFullPath).then((geo) => {
      // Update all objects sharing this fileId (duplicate case)
      setScene((prev) => prev ? {
        ...prev,
        objects: prev.objects.map((o) =>
          o.fileId === obj.fileId && o.loadStatus !== 'loaded'
            ? { ...o, geometry: geo, loadStatus: 'loaded' }
            : o
        ),
      } : prev);
    }).catch(() => {
      setScene((prev) => prev ? {
        ...prev,
        objects: prev.objects.map((o) =>
          o.id === obj.id ? { ...o, loadStatus: 'error' } : o
        ),
      } : prev);
    });
  }, [loadGeometry]);

  const addObject = useCallback((
    fileId: string,
    fileName: string,
    fileFullPath: string | null,
    fileThumbnail: string | null,
    sceneId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize = 25.4,
    gridEnabled = false,
  ) => {
    const id = crypto.randomUUID();
    const snapOffset = gridEnabled ? gridSize : 10;
    const newObj: SceneObject = {
      id,
      sceneId,
      fileId,
      fileName,
      fileFullPath,
      fileThumbnail,
      position: [snapOffset * Math.random(), 0, snapOffset * Math.random()],
      rotationY: 0,
      scale: [1, 1, 1],
      color: null,
      sortOrder: 0,
      geometry: null,
      loadStatus: 'pending',
    };

    // Increment refcount
    const entry = cache.current.get(fileId) ?? { promise: null, geometry: null, refCount: 0 };
    entry.refCount++;
    cache.current.set(fileId, entry);

    setScene((prev) => {
      if (!prev) return prev;
      const sortOrder = prev.objects.length;
      return {
        ...prev,
        objects: [...prev.objects, { ...newObj, sortOrder }],
        isDirty: true,
      };
    });

    // Trigger geometry load
    if (fileFullPath) {
      loadGeometryForObject(newObj, setScene);
    }
  }, [loadGeometryForObject]);

  const removeObject = useCallback((
    objectId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    setScene((prev) => {
      if (!prev) return prev;
      const obj = prev.objects.find((o) => o.id === objectId);
      if (!obj) return prev;

      // Decrement refcount and dispose if hits 0
      const entry = cache.current.get(obj.fileId);
      if (entry) {
        entry.refCount--;
        if (entry.refCount <= 0) {
          entry.geometry?.dispose();
          cache.current.delete(obj.fileId);
        }
      }

      return {
        ...prev,
        objects: prev.objects.filter((o) => o.id !== objectId),
        selectedObjectId: prev.selectedObjectId === objectId ? null : prev.selectedObjectId,
        isDirty: true,
      };
    });
  }, []);

  const duplicateObject = useCallback((
    objectId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize = 25.4,
  ) => {
    setScene((prev) => {
      if (!prev) return prev;
      const src = prev.objects.find((o) => o.id === objectId);
      if (!src) return prev;

      const newId = crypto.randomUUID();
      const offset = gridSize;
      const duplicate: SceneObject = {
        ...src,
        id: newId,
        position: [src.position[0] + offset, src.position[1], src.position[2] + offset],
        sortOrder: prev.objects.length,
        // Share geometry reference (already in cache)
        geometry: src.geometry,
        loadStatus: src.loadStatus,
      };

      // Increment refcount for shared geometry
      const entry = cache.current.get(src.fileId);
      if (entry) entry.refCount++;

      return {
        ...prev,
        objects: [...prev.objects, duplicate],
        selectedObjectId: newId,
        isDirty: true,
      };
    });
  }, []);

  const updateTransform = useCallback((
    objectId: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale' | 'color'>>,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    setScene((prev) => prev ? {
      ...prev,
      objects: prev.objects.map((o) => o.id === objectId ? { ...o, ...patch } : o),
      isDirty: true,
    } : prev);
  }, []);

  const selectObject = useCallback((
    objectId: string | null,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    setScene((prev) => prev ? { ...prev, selectedObjectId: objectId } : prev);
  }, []);

  const disposeAll = useCallback(() => {
    for (const entry of cache.current.values()) {
      entry.geometry?.dispose();
    }
    cache.current.clear();
  }, []);

  return { addObject, removeObject, duplicateObject, updateTransform, selectObject, loadGeometryForObject, disposeAll };
}

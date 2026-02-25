import { useRef, useCallback } from 'react';
import { GeometryCache } from '../utils/geometryCache';
import type { SceneObject, SceneState } from '../types/scene';

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
  hydrateCacheFromScene: (objects: SceneObject[]) => void;
  disposeAll: () => void;
}

export function useSceneObjects(): UseSceneObjectsReturn {
  const cache = useRef(new GeometryCache()).current;

  const loadGeometryForObject = useCallback((
    obj: SceneObject,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    if (!obj.fileFullPath) return;

    // Register ownership as first step — handles objects that bypassed addObject
    // (e.g. objects restored from DB via openScene/createScene).
    cache.addOwner(obj.fileId, obj.id);

    const cached = cache.getImmediate(obj.fileId);
    if (cached) {
      setScene((prev) => prev ? {
        ...prev,
        objects: prev.objects.map((o) =>
          o.id === obj.id ? { ...o, geometry: cached, loadStatus: 'loaded' } : o
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

    cache.getOrLoad(obj.fileId, obj.fileFullPath).then((geo) => {
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
  }, [cache]);

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

    // Register ownership OUTSIDE the updater (updaters must be pure)
    cache.addOwner(fileId, id);

    setScene((prev) => {
      if (!prev) return prev;
      const sortOrder = prev.objects.length;
      return {
        ...prev,
        objects: [...prev.objects, { ...newObj, sortOrder }],
        changeVersion: prev.changeVersion + 1,
      };
    });

    // Trigger geometry load
    if (fileFullPath) {
      loadGeometryForObject(newObj, setScene);
    }
  }, [cache, loadGeometryForObject]);

  const removeObject = useCallback((
    objectId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    // Extract fileId via the updater (peek pattern), then perform cache
    // mutation OUTSIDE the updater to keep the updater pure. This is safe
    // because setScene's updater runs synchronously; fileId is set by the
    // time the next line executes.
    let fileId: string | undefined;
    setScene((prev) => {
      if (!prev) return prev;
      const obj = prev.objects.find((o) => o.id === objectId);
      if (!obj) return prev;
      fileId = obj.fileId;
      return {
        ...prev,
        objects: prev.objects.filter((o) => o.id !== objectId),
        selectedObjectId: prev.selectedObjectId === objectId ? null : prev.selectedObjectId,
        changeVersion: prev.changeVersion + 1,
      };
    });

    // Cache mutation outside the updater — safe from StrictMode double-invoke
    if (fileId) {
      cache.removeOwner(fileId, objectId);
    }
  }, [cache]);

  const duplicateObject = useCallback((
    objectId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize = 25.4,
  ) => {
    // Generate newId and extract fileId OUTSIDE the updater so cache
    // registration happens outside the pure updater function.
    const newId = crypto.randomUUID();
    let fileId: string | undefined;

    setScene((prev) => {
      if (!prev) return prev;
      const src = prev.objects.find((o) => o.id === objectId);
      if (!src) return prev;
      fileId = src.fileId;

      const offset = gridSize;
      const duplicate: SceneObject = {
        ...src,
        id: newId,
        position: [src.position[0] + offset, src.position[1], src.position[2] + offset],
        sortOrder: prev.objects.length,
        geometry: src.geometry,
        loadStatus: src.loadStatus,
      };

      return {
        ...prev,
        objects: [...prev.objects, duplicate],
        selectedObjectId: newId,
        changeVersion: prev.changeVersion + 1,
      };
    });

    // Register ownership outside the updater
    if (fileId) {
      cache.addOwner(fileId, newId);
    }
  }, [cache]);

  const updateTransform = useCallback((
    objectId: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale' | 'color'>>,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    setScene((prev) => prev ? {
      ...prev,
      objects: prev.objects.map((o) => o.id === objectId ? { ...o, ...patch } : o),
      changeVersion: prev.changeVersion + 1,
    } : prev);
  }, []);

  const selectObject = useCallback((
    objectId: string | null,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    setScene((prev) => prev ? { ...prev, selectedObjectId: objectId } : prev);
  }, []);

  const hydrateCacheFromScene = useCallback((objects: SceneObject[]) => {
    cache.hydrateOwners(objects);
  }, [cache]);

  const disposeAll = useCallback(() => {
    cache.disposeAll();
  }, [cache]);

  return {
    addObject, removeObject, duplicateObject, updateTransform,
    selectObject, loadGeometryForObject, hydrateCacheFromScene, disposeAll,
  };
}

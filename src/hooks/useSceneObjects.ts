import { useRef, useCallback, useEffect } from 'react';
import { GeometryCache } from '../utils/geometryCache';
import type { SceneObject, SceneState } from '../types/scene';

/** Snapshot of an object's data for clipboard paste (no geometry/runtime state). */
export interface ObjectClipboard {
  fileId: string;
  fileName: string;
  fileFullPath: string | null;
  fileThumbnail: string | null;
  sceneId: string;
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  color: string | null;
}

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
    fileId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => void;
  duplicateObject: (
    source: Pick<SceneObject, 'id' | 'fileId' | 'fileName' | 'fileFullPath' | 'fileThumbnail' | 'sceneId' | 'position' | 'rotationY' | 'scale' | 'color' | 'geometry' | 'loadStatus'>,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize?: number,
  ) => void;
  duplicateObjects: (
    sources: Pick<SceneObject, 'id' | 'fileId' | 'fileName' | 'fileFullPath' | 'fileThumbnail' | 'sceneId' | 'position' | 'rotationY' | 'scale' | 'color' | 'geometry' | 'loadStatus'>[],
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize?: number,
  ) => void;
  pasteObject: (
    clipboard: ObjectClipboard,
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
    toggle?: boolean,
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
  const mountedRef = useRef(true);

  // Clean up mounted flag on unmount to prevent stale setScene calls
  // from in-flight geometry load promises.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
      if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
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
    fileId: string,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
  ) => {
    // fileId provided by caller — no state-updater side-channel needed.
    // Cache mutation outside the updater, safe from StrictMode double-invoke.
    cache.removeOwner(fileId, objectId);

    setScene((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        objects: prev.objects.filter((o) => o.id !== objectId),
        selectedObjectIds: prev.selectedObjectIds.filter((id) => id !== objectId),
        changeVersion: prev.changeVersion + 1,
      };
    });
  }, [cache]);

  type DuplicateSource = Pick<SceneObject, 'id' | 'fileId' | 'fileName' | 'fileFullPath' | 'fileThumbnail' | 'sceneId' | 'position' | 'rotationY' | 'scale' | 'color' | 'geometry' | 'loadStatus'>;

  const duplicateObject = useCallback((
    source: DuplicateSource,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize = 25.4,
  ) => {
    // Source object data provided by caller — no state-updater side-channel.
    const newId = crypto.randomUUID();
    const offset = gridSize;

    // Register ownership before state update (idempotent, no harm if update fails)
    cache.addOwner(source.fileId, newId);

    setScene((prev) => {
      if (!prev) return prev;
      const duplicate: SceneObject = {
        id: newId,
        sceneId: source.sceneId,
        fileId: source.fileId,
        fileName: source.fileName,
        fileFullPath: source.fileFullPath,
        fileThumbnail: source.fileThumbnail,
        position: [source.position[0] + offset, source.position[1], source.position[2] + offset],
        rotationY: source.rotationY,
        scale: [...source.scale],
        color: source.color,
        sortOrder: prev.objects.length,
        geometry: source.geometry,
        loadStatus: source.loadStatus,
      };
      return {
        ...prev,
        objects: [...prev.objects, duplicate],
        selectedObjectIds: [newId],
        changeVersion: prev.changeVersion + 1,
      };
    });
  }, [cache]);

  const duplicateObjects = useCallback((
    sources: DuplicateSource[],
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize = 25.4,
  ) => {
    if (sources.length === 0) return;
    const offset = gridSize;
    const newIds: string[] = [];
    const duplicates: Array<{ source: DuplicateSource; newId: string }> = [];

    for (const source of sources) {
      const newId = crypto.randomUUID();
      newIds.push(newId);
      duplicates.push({ source, newId });
      // Register ownership before state update
      cache.addOwner(source.fileId, newId);
    }

    // Single state update for all duplications
    setScene((prev) => {
      if (!prev) return prev;
      const newObjects = duplicates.map(({ source, newId }, i) => ({
        id: newId,
        sceneId: source.sceneId,
        fileId: source.fileId,
        fileName: source.fileName,
        fileFullPath: source.fileFullPath,
        fileThumbnail: source.fileThumbnail,
        position: [source.position[0] + offset, source.position[1], source.position[2] + offset] as [number, number, number],
        rotationY: source.rotationY,
        scale: [...source.scale] as [number, number, number],
        color: source.color,
        sortOrder: prev.objects.length + i,
        geometry: source.geometry,
        loadStatus: source.loadStatus,
      }));
      return {
        ...prev,
        objects: [...prev.objects, ...newObjects],
        selectedObjectIds: newIds,
        changeVersion: prev.changeVersion + 1,
      };
    });
  }, [cache]);

  const pasteObject = useCallback((
    clipboard: ObjectClipboard,
    setScene: React.Dispatch<React.SetStateAction<SceneState | null>>,
    gridSize = 25.4,
  ) => {
    const id = crypto.randomUUID();
    const offset = gridSize;
    const newObj: SceneObject = {
      id,
      sceneId: clipboard.sceneId,
      fileId: clipboard.fileId,
      fileName: clipboard.fileName,
      fileFullPath: clipboard.fileFullPath,
      fileThumbnail: clipboard.fileThumbnail,
      position: [clipboard.position[0] + offset, clipboard.position[1], clipboard.position[2] + offset],
      rotationY: clipboard.rotationY,
      scale: [...clipboard.scale],
      color: clipboard.color,
      sortOrder: 0,
      geometry: null,
      loadStatus: 'pending',
    };

    cache.addOwner(clipboard.fileId, id);

    setScene((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        objects: [...prev.objects, { ...newObj, sortOrder: prev.objects.length }],
        selectedObjectIds: [id],
        changeVersion: prev.changeVersion + 1,
      };
    });

    if (clipboard.fileFullPath) {
      loadGeometryForObject(newObj, setScene);
    }
  }, [cache, loadGeometryForObject]);

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
    toggle = false,
  ) => {
    setScene((prev) => {
      if (!prev) return prev;
      if (objectId === null) return { ...prev, selectedObjectIds: [] };
      if (toggle) {
        const has = prev.selectedObjectIds.includes(objectId);
        return {
          ...prev,
          selectedObjectIds: has
            ? prev.selectedObjectIds.filter((id) => id !== objectId)
            : [...prev.selectedObjectIds, objectId],
        };
      }
      return { ...prev, selectedObjectIds: [objectId] };
    });
  }, []);

  const hydrateCacheFromScene = useCallback((objects: SceneObject[]) => {
    cache.hydrateOwners(objects);
  }, [cache]);

  const disposeAll = useCallback(() => {
    cache.disposeAll();
  }, [cache]);

  return {
    addObject, removeObject, duplicateObject, duplicateObjects, pasteObject,
    updateTransform, selectObject, loadGeometryForObject, hydrateCacheFromScene, disposeAll,
  };
}

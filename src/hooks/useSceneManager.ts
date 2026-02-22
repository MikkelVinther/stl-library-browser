import { useState, useEffect, useCallback } from 'react';
import { getAllScenes, getScene, saveScene, deleteScene as deleteSceneDB } from '../utils/electronBridge';
import type { SceneMeta, SceneState, SceneObject, SceneObjectData } from '../types/scene';

export interface UseSceneManagerReturn {
  scenes: SceneMeta[];
  activeScene: SceneState | null;
  createScene: (name: string, initialFileIds?: string[]) => Promise<void>;
  openScene: (id: string) => Promise<void>;
  closeScene: (disposeGeometries?: () => void) => void;
  deleteScene: (id: string) => Promise<void>;
  setActiveScene: React.Dispatch<React.SetStateAction<SceneState | null>>;
}

function makeMeta(name: string): SceneMeta {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    gridSize: 25.4,
    gridEnabled: false,
    cameraJson: null,
  };
}

function objectDataToSceneObject(data: SceneObjectData): SceneObject {
  return { ...data, geometry: null, loadStatus: 'pending' };
}

export function useSceneManager(): UseSceneManagerReturn {
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [activeScene, setActiveScene] = useState<SceneState | null>(null);

  useEffect(() => {
    getAllScenes().then(setScenes);
  }, []);

  const createScene = useCallback(async (name: string, initialFileIds?: string[]) => {
    const meta = makeMeta(name);
    await saveScene(meta);
    const freshMeta = { ...meta };
    setScenes((prev) => [freshMeta, ...prev]);

    // Build initial objects from fileIds — geometry loads later in useSceneObjects
    const objects: SceneObject[] = (initialFileIds ?? []).map((fileId, idx) => ({
      id: crypto.randomUUID(),
      sceneId: meta.id,
      fileId,
      position: [0, 0, 0],
      rotationY: 0,
      scale: [1, 1, 1],
      color: null,
      sortOrder: idx,
      fileName: '',
      fileFullPath: null,
      fileThumbnail: null,
      geometry: null,
      loadStatus: 'pending',
    }));

    setActiveScene({
      meta,
      objects,
      selectedObjectId: null,
      transformMode: 'translate',
      isDirty: objects.length > 0,
    });
  }, []);

  const openScene = useCallback(async (id: string) => {
    const data = await getScene(id);
    if (!data) return;
    const { objects: rawObjects, ...meta } = data;
    setActiveScene({
      meta,
      objects: rawObjects.map(objectDataToSceneObject),
      selectedObjectId: null,
      transformMode: 'translate',
      isDirty: false,
    });
  }, []);

  const closeScene = useCallback((disposeGeometries?: () => void) => {
    disposeGeometries?.();
    setActiveScene(null);
  }, []);

  const deleteScene = useCallback(async (id: string) => {
    await deleteSceneDB(id);
    setScenes((prev) => prev.filter((s) => s.id !== id));
    setActiveScene((prev) => (prev?.meta.id === id ? null : prev));
  }, []);

  return { scenes, activeScene, createScene, openScene, closeScene, deleteScene, setActiveScene };
}

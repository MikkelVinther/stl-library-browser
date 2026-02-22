import { useRef, useCallback, useEffect } from 'react';
import { saveScene, saveSceneObjects } from '../utils/electronBridge';
import type { SceneState } from '../types/scene';

const AUTOSAVE_DELAY_MS = 2000;

export interface UseScenePersistenceReturn {
  isSaving: boolean;
  triggerSave: (scene: SceneState) => void;
  manualSave: (scene: SceneState) => Promise<void>;
  markClean: (setScene: React.Dispatch<React.SetStateAction<SceneState | null>>) => void;
}

export function useScenePersistence(): UseScenePersistenceReturn {
  const isSavingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSceneRef = useRef<SceneState | null>(null);

  const performSave = useCallback(async (scene: SceneState) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const { meta, objects } = scene;
      await saveScene({ ...meta, updatedAt: Date.now() });
      await saveSceneObjects(meta.id, objects.map((o, idx) => ({
        id: o.id,
        sceneId: o.sceneId,
        fileId: o.fileId,
        position: o.position,
        rotationY: o.rotationY,
        scale: o.scale,
        color: o.color,
        sortOrder: idx,
        fileName: o.fileName,
        fileFullPath: o.fileFullPath,
        fileThumbnail: o.fileThumbnail,
      })));
    } catch (e) {
      console.error('[useScenePersistence] Save failed:', e);
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const triggerSave = useCallback((scene: SceneState) => {
    pendingSceneRef.current = scene;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (pendingSceneRef.current) {
        performSave(pendingSceneRef.current);
        pendingSceneRef.current = null;
      }
    }, AUTOSAVE_DELAY_MS);
  }, [performSave]);

  const manualSave = useCallback(async (scene: SceneState) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    pendingSceneRef.current = null;
    await performSave(scene);
  }, [performSave]);

  const markClean = useCallback((setScene: React.Dispatch<React.SetStateAction<SceneState | null>>) => {
    setScene((prev) => prev ? { ...prev, isDirty: false } : prev);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { isSaving: isSavingRef.current, triggerSave, manualSave, markClean };
}

import { useRef, useCallback, useEffect, useState } from 'react';
import { saveScene, saveSceneObjects } from '../utils/electronBridge';
import type { SceneState, SceneObjectData } from '../types/scene';

const AUTOSAVE_DELAY_MS = 2000;

export type SaveResult =
  | { ok: true; savedVersion: number; updatedAt: number }
  | { ok: false; error: string };

export interface UseScenePersistenceReturn {
  isSaving: boolean;
  /** Queue scene for autosave after debounce. onDrain is called with the result after each drain. */
  queueAutosave: (scene: SceneState, onDrain?: (result: SaveResult, scene: SceneState) => void) => void;
  saveNow: (scene: SceneState) => Promise<SaveResult>;
}

function toObjectData(scene: SceneState): SceneObjectData[] {
  return scene.objects.map((o, idx) => ({
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
  }));
}

async function persistScene(scene: SceneState): Promise<number> {
  const updatedAt = Date.now();
  await saveScene({ ...scene.meta, updatedAt });
  await saveSceneObjects(scene.meta.id, toObjectData(scene));
  return updatedAt;
}

export function useScenePersistence(): UseScenePersistenceReturn {
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the most-recent snapshot queued for autosave.
  // Single-element queue: newer snapshot always overwrites older one.
  const latestQueuedSceneRef = useRef<SceneState | null>(null);
  // Prevents two concurrent drainQueue calls from racing.
  const isDrainingRef = useRef(false);

  /** Drain the queue: persist whatever is in latestQueuedSceneRef, loop until empty. */
  const drainQueue = useCallback(async (onDrain?: (result: SaveResult, scene: SceneState) => void) => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;
    setIsSaving(true);

    try {
      while (latestQueuedSceneRef.current !== null) {
        // Atomically take the snapshot so a concurrent mutation that sets a new
        // snapshot during the await gets picked up in the next loop iteration.
        const snapshot = latestQueuedSceneRef.current;
        latestQueuedSceneRef.current = null;

        try {
          const updatedAt = await persistScene(snapshot);
          onDrain?.({ ok: true, savedVersion: snapshot.changeVersion, updatedAt }, snapshot);
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          console.error('[useScenePersistence] Autosave failed:', e);
          onDrain?.({ ok: false, error }, snapshot);
          // Stop draining on error; the snapshot was already cleared.
          break;
        }
      }
    } finally {
      isDrainingRef.current = false;
      setIsSaving(false);
    }
  }, []);

  const queueAutosave = useCallback((scene: SceneState, onDrain?: (result: SaveResult, scene: SceneState) => void) => {
    latestQueuedSceneRef.current = scene;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      drainQueue(onDrain);
    }, AUTOSAVE_DELAY_MS);
  }, [drainQueue]);

  const saveNow = useCallback(async (scene: SceneState): Promise<SaveResult> => {
    // Cancel any pending autosave debounce; we're saving immediately.
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
    // Discard any queued autosave snapshot — saveNow supersedes it.
    latestQueuedSceneRef.current = null;

    setIsSaving(true);
    try {
      const updatedAt = await persistScene(scene);
      return { ok: true, savedVersion: scene.changeVersion, updatedAt };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[useScenePersistence] Manual save failed:', e);
      return { ok: false, error };
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { isSaving, queueAutosave, saveNow };
}

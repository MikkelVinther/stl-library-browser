import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import type { SceneState, SceneObject } from '../../types/scene';
import type { STLFile } from '../../types/index';
import { SceneCanvas } from './SceneCanvas';
import { SceneToolbar } from './SceneToolbar';
import { SceneSidebar } from './SceneSidebar';
import { useSceneObjects } from '../../hooks/useSceneObjects';
import { useGridSnap } from '../../hooks/useGridSnap';
import { useScenePersistence } from '../../hooks/useScenePersistence';

interface SceneBuilderProps {
  sceneState: SceneState;
  setSceneState: React.Dispatch<React.SetStateAction<SceneState | null>>;
  allFiles: STLFile[];
  onClose: (disposeGeometries?: () => void) => void;
  onRefreshScenes: () => Promise<void>;
}

export default function SceneBuilder({ sceneState, setSceneState, allFiles, onClose, onRefreshScenes }: SceneBuilderProps) {
  const { addObject, removeObject, duplicateObject, updateTransform, selectObject, loadGeometryForObject, hydrateCacheFromScene, disposeAll } = useSceneObjects();
  const { toggleGrid, setGridSize } = useGridSnap();
  const { isSaving, queueAutosave, saveNow } = useScenePersistence();
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [exitSaveError, setExitSaveError] = useState<string | null>(null);

  const hasUnsavedChanges = sceneState.changeVersion > sceneState.savedVersion;

  // Stable ref to onRefreshScenes so the autosave callback doesn't close over stale state
  const refreshRef = useRef(onRefreshScenes);
  useEffect(() => { refreshRef.current = onRefreshScenes; }, [onRefreshScenes]);

  // Defensive hydration: seed cache ownership for pre-existing objects (opened
  // from DB). In practice, all objects start as 'pending' and register via
  // loadGeometryForObject mount effects (which fire before this parent effect).
  // This ensures the owners set is complete for any edge cases.
  const lastHydratedSceneId = useRef<string | null>(null);
  useEffect(() => {
    if (sceneState.meta.id !== lastHydratedSceneId.current) {
      hydrateCacheFromScene(sceneState.objects);
      lastHydratedSceneId.current = sceneState.meta.id;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneState.meta.id]);

  // Autosave whenever changeVersion advances past savedVersion
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    queueAutosave(sceneState, (result, savedScene) => {
      if (result.ok) {
        setSceneState((prev) => prev ? {
          ...prev,
          savedVersion: result.savedVersion,
          meta: { ...prev.meta, updatedAt: result.updatedAt },
          lastSaveError: null,
        } : prev);
        refreshRef.current();
      } else {
        // Only update error if the scene hasn't been closed in the meantime
        setSceneState((prev) => prev ? { ...prev, lastSaveError: result.error } : prev);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneState.changeVersion]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      setExitSaveError(null);
      setShowExitPrompt(true);
    } else {
      onClose(disposeAll);
    }
  }, [hasUnsavedChanges, onClose, disposeAll]);

  const handleSave = useCallback(async () => {
    const result = await saveNow(sceneState);
    if (result.ok) {
      setSceneState((prev) => prev ? {
        ...prev,
        savedVersion: result.savedVersion,
        meta: { ...prev.meta, updatedAt: result.updatedAt },
        lastSaveError: null,
      } : prev);
      onRefreshScenes();
    } else {
      setSceneState((prev) => prev ? { ...prev, lastSaveError: result.error } : prev);
    }
  }, [sceneState, saveNow, setSceneState, onRefreshScenes]);

  const handleSelect = useCallback((id: string | null) => {
    selectObject(id, setSceneState);
  }, [selectObject, setSceneState]);

  const handleLoadGeometry = useCallback((obj: SceneObject) => {
    loadGeometryForObject(obj, setSceneState);
  }, [loadGeometryForObject, setSceneState]);

  const handleTransformCommit = useCallback((
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale'>>,
  ) => {
    updateTransform(id, patch, setSceneState);
  }, [updateTransform, setSceneState]);

  const handleSetTransformMode = useCallback((mode: 'translate' | 'rotate' | 'scale') => {
    setSceneState((prev) => prev ? { ...prev, transformMode: mode } : prev);
  }, [setSceneState]);

  const handleToggleGrid = useCallback(() => {
    toggleGrid(setSceneState);
  }, [toggleGrid, setSceneState]);

  const handleSetGridSize = useCallback((size: number) => {
    setGridSize(size, setSceneState);
  }, [setGridSize, setSceneState]);

  const handleRename = useCallback((name: string) => {
    setSceneState((prev) => prev ? {
      ...prev,
      meta: { ...prev.meta, name },
      changeVersion: prev.changeVersion + 1,
    } : prev);
  }, [setSceneState]);

  const handleAddFile = useCallback((file: STLFile) => {
    if (!file.fullPath) return;
    addObject(
      file.id, file.name, file.fullPath, file.thumbnail,
      sceneState.meta.id, setSceneState,
      sceneState.meta.gridSize, sceneState.meta.gridEnabled,
    );
  }, [addObject, sceneState.meta, setSceneState]);

  const handleRemoveObject = useCallback((id: string) => {
    removeObject(id, setSceneState);
  }, [removeObject, setSceneState]);

  const handleColorChange = useCallback((objectId: string, color: string) => {
    updateTransform(objectId, { color: color || null }, setSceneState);
  }, [updateTransform, setSceneState]);

  const handleDuplicate = useCallback(() => {
    if (!sceneState.selectedObjectId) return;
    duplicateObject(sceneState.selectedObjectId, setSceneState, sceneState.meta.gridSize);
  }, [sceneState.selectedObjectId, sceneState.meta.gridSize, duplicateObject, setSceneState]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' || target.isContentEditable) return;

      switch (e.key) {
        case 'w': case 'W': handleSetTransformMode('translate'); break;
        case 'e': case 'E': handleSetTransformMode('rotate'); break;
        case 'r': case 'R': handleSetTransformMode('scale'); break;
        case 'g': case 'G': handleToggleGrid(); break;
        case 'Delete':
        case 'Backspace':
          if (sceneState.selectedObjectId) {
            handleRemoveObject(sceneState.selectedObjectId);
          }
          break;
        case 'd':
        case 'D':
          if ((e.metaKey || e.ctrlKey) && sceneState.selectedObjectId) {
            e.preventDefault();
            handleDuplicate();
          }
          break;
        case 'Escape':
          if (sceneState.selectedObjectId) {
            handleSelect(null);
          } else {
            handleBack();
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    sceneState.selectedObjectId, handleSetTransformMode, handleToggleGrid,
    handleRemoveObject, handleDuplicate, handleSelect, handleBack,
  ]);

  // Compute derived stats for toolbar
  const loadingCount = sceneState.objects.filter((o) => o.loadStatus === 'loading').length;
  const totalTriangles = useMemo(() =>
    sceneState.objects.reduce((sum, o) => {
      const count = o.geometry?.index
        ? o.geometry.index.count / 3
        : (o.geometry?.attributes.position?.count ?? 0) / 3;
      return sum + count;
    }, 0),
  [sceneState.objects]);

  return (
    <div className="flex flex-col h-screen bg-[#0a1020]">
      <SceneToolbar
        sceneState={sceneState}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        loadingCount={loadingCount}
        totalTriangles={totalTriangles}
        onBack={handleBack}
        onSave={handleSave}
        onToggleGrid={handleToggleGrid}
        onSetGridSize={handleSetGridSize}
        onSetTransformMode={handleSetTransformMode}
        onRename={handleRename}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <SceneCanvas
            sceneState={sceneState}
            onSelect={handleSelect}
            onLoadGeometry={handleLoadGeometry}
            onTransformCommit={handleTransformCommit}
          />
        </div>

        <SceneSidebar
          sceneState={sceneState}
          allFiles={allFiles}
          onSelectObject={(id) => handleSelect(id)}
          onRemoveObject={handleRemoveObject}
          onAddFile={handleAddFile}
          onColorChange={handleColorChange}
        />
      </div>

      {/* Unsaved changes exit prompt */}
      {showExitPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="overlay-panel rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-semibold text-slate-100">Unsaved Changes</h2>
            <p className="text-sm text-soft">You have unsaved changes in this scene. What would you like to do?</p>
            {exitSaveError && (
              <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 border border-red-700/40">
                Save failed: {exitSaveError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowExitPrompt(false); setExitSaveError(null); }}
                className="ui-btn ui-btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowExitPrompt(false); setExitSaveError(null); onClose(disposeAll); }}
                className="ui-btn ui-btn-secondary px-4 py-2 text-sm"
              >
                Discard
              </button>
              <button
                disabled={isSaving}
                onClick={async () => {
                  setExitSaveError(null);
                  const result = await saveNow(sceneState);
                  if (result.ok) {
                    setSceneState((prev) => prev ? {
                      ...prev,
                      savedVersion: result.savedVersion,
                      meta: { ...prev.meta, updatedAt: result.updatedAt },
                      lastSaveError: null,
                    } : prev);
                    await onRefreshScenes();
                    setShowExitPrompt(false);
                    onClose(disposeAll);
                  } else {
                    setExitSaveError(result.error);
                  }
                }}
                className="ui-btn ui-btn-primary px-4 py-2 text-sm"
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

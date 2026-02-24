import { useCallback } from 'react';
import type { SceneState } from '../types/scene';

export interface UseGridSnapReturn {
  toggleGrid: (setScene: React.Dispatch<React.SetStateAction<SceneState | null>>) => void;
  setGridSize: (size: number, setScene: React.Dispatch<React.SetStateAction<SceneState | null>>) => void;
  snapPosition: (pos: [number, number, number], gridSize: number) => [number, number, number];
}

export function useGridSnap(): UseGridSnapReturn {
  const toggleGrid = useCallback((setScene: React.Dispatch<React.SetStateAction<SceneState | null>>) => {
    setScene((prev) => prev ? {
      ...prev,
      meta: { ...prev.meta, gridEnabled: !prev.meta.gridEnabled },
      changeVersion: prev.changeVersion + 1,
    } : prev);
  }, []);

  const setGridSize = useCallback((size: number, setScene: React.Dispatch<React.SetStateAction<SceneState | null>>) => {
    setScene((prev) => prev ? {
      ...prev,
      meta: { ...prev.meta, gridSize: size },
      changeVersion: prev.changeVersion + 1,
    } : prev);
  }, []);

  const snapPosition = useCallback((
    pos: [number, number, number],
    gridSize: number,
  ): [number, number, number] => {
    const snap = (v: number) => Math.round(v / gridSize) * gridSize;
    return [snap(pos[0]), pos[1], snap(pos[2])];
  }, []);

  return { toggleGrid, setGridSize, snapPosition };
}

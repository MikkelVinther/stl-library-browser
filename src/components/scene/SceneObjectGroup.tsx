import { memo } from 'react';
import type { SceneObject } from '../../types/scene';
import { SceneObject3D } from './SceneObject3D';

interface SceneObjectGroupProps {
  objects: SceneObject[];
  selectedIdSet: Set<string>;
  transformMode: 'translate' | 'rotate' | 'scale';
  gridEnabled: boolean;
  gridSize: number;
  onSelect: (id: string, toggle?: boolean) => void;
  onLoadGeometry: (obj: SceneObject) => void;
  onTransformCommit: (
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale'>>,
  ) => void;
}

export const SceneObjectGroup = memo(function SceneObjectGroup({
  objects, selectedIdSet, transformMode, gridEnabled, gridSize,
  onSelect, onLoadGeometry, onTransformCommit,
}: SceneObjectGroupProps) {
  const isSingleSelection = selectedIdSet.size === 1;
  return (
    <>
      {objects.map((obj) => {
        const isSelected = selectedIdSet.has(obj.id);
        return (
          <SceneObject3D
            key={obj.id}
            obj={obj}
            isSelected={isSelected}
            showGizmo={isSelected && isSingleSelection}
            transformMode={transformMode}
            gridEnabled={gridEnabled}
            gridSize={gridSize}
            onSelect={onSelect}
            onLoadGeometry={onLoadGeometry}
            onTransformCommit={onTransformCommit}
          />
        );
      })}
    </>
  );
});

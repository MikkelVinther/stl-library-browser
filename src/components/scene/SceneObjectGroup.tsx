import { memo } from 'react';
import type { SceneObject } from '../../types/scene';
import { SceneObject3D } from './SceneObject3D';

interface SceneObjectGroupProps {
  objects: SceneObject[];
  selectedObjectIds: string[];
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
  objects, selectedObjectIds, transformMode, gridEnabled, gridSize,
  onSelect, onLoadGeometry, onTransformCommit,
}: SceneObjectGroupProps) {
  const isSingleSelection = selectedObjectIds.length === 1;
  return (
    <>
      {objects.map((obj) => {
        const isSelected = selectedObjectIds.includes(obj.id);
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

import { memo } from 'react';
import type { SceneObject } from '../../types/scene';
import { SceneObject3D } from './SceneObject3D';

interface SceneObjectGroupProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  transformMode: 'translate' | 'rotate' | 'scale';
  gridEnabled: boolean;
  gridSize: number;
  onSelect: (id: string) => void;
  onLoadGeometry: (obj: SceneObject) => void;
  onTransformCommit: (
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale'>>,
  ) => void;
}

export const SceneObjectGroup = memo(function SceneObjectGroup({
  objects, selectedObjectId, transformMode, gridEnabled, gridSize,
  onSelect, onLoadGeometry, onTransformCommit,
}: SceneObjectGroupProps) {
  return (
    <>
      {objects.map((obj) => (
        <SceneObject3D
          key={obj.id}
          obj={obj}
          isSelected={obj.id === selectedObjectId}
          transformMode={transformMode}
          gridEnabled={gridEnabled}
          gridSize={gridSize}
          onSelect={onSelect}
          onLoadGeometry={onLoadGeometry}
          onTransformCommit={onTransformCommit}
        />
      ))}
    </>
  );
});

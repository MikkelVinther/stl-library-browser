import { memo, useRef, useEffect } from 'react';
import type { Mesh } from 'three';
import type { SceneObject } from '../../types/scene';
import { TransformGizmo } from './TransformGizmo';

interface SceneObject3DProps {
  obj: SceneObject;
  isSelected: boolean;
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

const SELECTED_COLOR = '#ff9944';
const DEFAULT_COLOR = '#6090c0';

export const SceneObject3D = memo(function SceneObject3D({
  obj,
  isSelected,
  transformMode,
  gridEnabled,
  gridSize,
  onSelect,
  onLoadGeometry,
  onTransformCommit,
}: SceneObject3DProps) {
  const meshRef = useRef<Mesh>(null);

  // Trigger geometry load on mount if not yet loaded
  useEffect(() => {
    if (obj.loadStatus === 'pending' && obj.fileFullPath) {
      onLoadGeometry(obj);
    }
  }, [obj.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(obj.id);
  };

  const color = isSelected ? SELECTED_COLOR : (obj.color ?? DEFAULT_COLOR);

  if (!obj.geometry || obj.loadStatus !== 'loaded') {
    return (
      <mesh
        position={obj.position}
        rotation={[0, obj.rotationY, 0]}
        scale={obj.scale}
        onClick={handleClick}
      >
        <boxGeometry args={[25, 25, 25]} />
        <meshStandardMaterial color={color} wireframe opacity={0.4} transparent />
      </mesh>
    );
  }

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={obj.geometry}
        position={obj.position}
        rotation={[0, obj.rotationY, 0]}
        scale={obj.scale}
        onClick={handleClick}
      >
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.55} />
      </mesh>

      {isSelected && (
        <TransformGizmo
          meshRef={meshRef}
          object={obj}
          mode={transformMode}
          gridEnabled={gridEnabled}
          gridSize={gridSize}
          onCommit={onTransformCommit}
        />
      )}
    </>
  );
});

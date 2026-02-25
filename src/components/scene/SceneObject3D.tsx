import { memo, useRef, useEffect, useLayoutEffect } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneObject } from '../../types/scene';

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
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);

  // Trigger geometry load on mount if not yet loaded
  useEffect(() => {
    if (obj.loadStatus === 'pending' && obj.fileFullPath) {
      onLoadGeometry(obj);
    }
  }, [obj.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync group transform from state when not being dragged by the gizmo.
  // useLayoutEffect runs synchronously before paint, preventing one-frame
  // flicker. Deps are array references (new ref per state update), which is
  // acceptable — the memo wrapper prevents re-renders from unrelated objects.
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g || isDragging.current) return;
    g.position.set(...obj.position);
    g.rotation.set(0, obj.rotationY, 0);
    g.scale.set(...obj.scale);
  }, [obj.position, obj.rotationY, obj.scale]);

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(obj.id);
  };

  const handleMouseDown = () => { isDragging.current = true; };

  const handleMouseUp = () => {
    const g = groupRef.current;
    if (!g) return;
    isDragging.current = false;
    onTransformCommit(obj.id, {
      position: [g.position.x, g.position.y, g.position.z],
      rotationY: g.rotation.y,
      scale: [g.scale.x, g.scale.y, g.scale.z],
    });
  };

  const color = isSelected ? SELECTED_COLOR : (obj.color ?? DEFAULT_COLOR);
  const isLoaded = obj.geometry && obj.loadStatus === 'loaded';

  return (
    <>
      <group ref={groupRef}>
        {isLoaded ? (
          <mesh geometry={obj.geometry!} onClick={handleClick}>
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.55} />
          </mesh>
        ) : (
          <mesh onClick={handleClick}>
            <boxGeometry args={[25, 25, 25]} />
            <meshStandardMaterial color={color} wireframe opacity={0.4} transparent />
          </mesh>
        )}
      </group>

      {isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          translationSnap={gridEnabled ? gridSize : null}
          rotationSnap={gridEnabled ? Math.PI / 12 : null}
          scaleSnap={null}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
      )}
    </>
  );
});

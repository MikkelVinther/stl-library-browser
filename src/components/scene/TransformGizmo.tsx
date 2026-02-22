import { useRef, useEffect, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneObject } from '../../types/scene';

interface TransformGizmoProps {
  meshRef: React.RefObject<THREE.Mesh | null>;
  object: SceneObject;
  mode: 'translate' | 'rotate' | 'scale';
  gridEnabled: boolean;
  gridSize: number;
  onCommit: (
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale'>>,
  ) => void;
}

export function TransformGizmo({ meshRef, object, mode, gridEnabled, gridSize, onCommit }: TransformGizmoProps) {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const isDragging = useRef(false);

  // Wait for mesh ref to populate
  useEffect(() => {
    if (meshRef.current) setMesh(meshRef.current);
  }, [meshRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = () => {
    const m = meshRef.current;
    if (!m) return;
    isDragging.current = false;

    onCommit(object.id, {
      position: [m.position.x, m.position.y, m.position.z],
      rotationY: m.rotation.y,
      scale: [m.scale.x, m.scale.y, m.scale.z],
    });
  };

  if (!mesh) return null;

  return (
    <TransformControls
      object={mesh}
      mode={mode}
      translationSnap={gridEnabled ? gridSize : null}
      rotationSnap={gridEnabled ? Math.PI / 12 : null}
      scaleSnap={null}
      onMouseDown={() => { isDragging.current = true; }}
      onMouseUp={handleMouseUp}
    />
  );
}

import { memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import type { SceneState, SceneObject } from '../../types/scene';
import { SceneGrid } from './SceneGrid';
import { SceneObjectGroup } from './SceneObjectGroup';

interface SceneCanvasProps {
  sceneState: SceneState;
  selectedIdSet: Set<string>;
  onSelect: (id: string | null, toggle?: boolean) => void;
  onLoadGeometry: (obj: SceneObject) => void;
  onTransformCommit: (
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotationY' | 'scale'>>,
  ) => void;
}

export const SceneCanvas = memo(function SceneCanvas({ sceneState, selectedIdSet, onSelect, onLoadGeometry, onTransformCommit }: SceneCanvasProps) {
  const { objects, transformMode, meta } = sceneState;

  return (
    <Canvas
      camera={{ position: [200, 150, 200], fov: 50, near: 0.1, far: 50000 }}
      gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
      onPointerMissed={() => onSelect(null)}
    >
      {/* Lighting rig — matches threeSceneSetup.ts constants */}
      <ambientLight color={0x404060} intensity={1.0} />
      <directionalLight color={0xffffff} intensity={1.8} position={[1, 1.5, 1]} />
      <directionalLight color={0x4a7aaa} intensity={0.5} position={[-1, 0.5, -0.5]} />
      <directionalLight color={0x3366ff} intensity={0.3} position={[0, -1, -1]} />

      <SceneGrid gridEnabled={meta.gridEnabled} gridSize={meta.gridSize} />

      <SceneObjectGroup
        objects={objects}
        selectedIdSet={selectedIdSet}
        transformMode={transformMode}
        gridEnabled={meta.gridEnabled}
        gridSize={meta.gridSize}
        onSelect={onSelect}
        onLoadGeometry={onLoadGeometry}
        onTransformCommit={onTransformCommit}
      />

      {/* makeDefault is required: registers as state.controls so drei's
          TransformControls can auto-disable orbit during gizmo drag. */}
      <OrbitControls
        makeDefault
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
      />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#e05050', '#50c050', '#5080e0']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
});

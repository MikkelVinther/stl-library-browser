import { Grid } from '@react-three/drei';

interface SceneGridProps {
  gridEnabled: boolean;
  gridSize: number;
}

export function SceneGrid({ gridEnabled, gridSize }: SceneGridProps) {
  const cellCount = 40;
  const totalSize = cellCount * gridSize;

  return (
    <>
      {/* Ground plane — always visible */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[totalSize, totalSize]} />
        <meshStandardMaterial color="#1a2235" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Grid lines — always mounted, toggled via visible to avoid repeated
          GPU resource teardown/recreation. */}
      <Grid
        visible={gridEnabled}
        position={[0, 0, 0]}
        args={[totalSize, totalSize]}
        cellSize={gridSize}
        cellThickness={0.5}
        cellColor="#3a5a8a"
        sectionSize={gridSize * 4}
        sectionThickness={1.0}
        sectionColor="#5080b0"
        fadeDistance={totalSize * 0.8}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
    </>
  );
}

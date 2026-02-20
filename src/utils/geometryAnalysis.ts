import * as THREE from 'three';
import type { BufferGeometry } from 'three';

export interface GeometryStats {
  triangleCount: number;
  dimensions: { x: number; y: number; z: number };
  volume: number | null;
  surfaceArea: number;
  isWatertight: boolean;
}

export function analyzeGeometry(geometry: BufferGeometry): GeometryStats {
  const position = geometry.attributes.position;
  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : position.count / 3;

  // Bounding box dimensions
  geometry.computeBoundingBox();
  const dims = new THREE.Vector3();
  geometry.boundingBox.getSize(dims);

  // Compute volume, surface area, and watertight check
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  let signedVolume = 0;
  let surfaceArea = 0;
  const edgeCounts = new Map<string, number>();

  const addEdge = (i1: number, i2: number): void => {
    const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  };

  for (let i = 0; i < triangleCount; i++) {
    let ia: number, ib: number, ic: number;
    if (index) {
      ia = index.getX(i * 3);
      ib = index.getX(i * 3 + 1);
      ic = index.getX(i * 3 + 2);
    } else {
      ia = i * 3;
      ib = i * 3 + 1;
      ic = i * 3 + 2;
    }

    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);

    // Signed volume of tetrahedron with origin
    signedVolume += a.dot(ab.copy(b).cross(ac.copy(c))) / 6;

    // Triangle area
    ab.copy(b).sub(a);
    ac.copy(c).sub(a);
    surfaceArea += ab.cross(ac).length() * 0.5;

    // Edge tracking for watertight check
    addEdge(ia, ib);
    addEdge(ib, ic);
    addEdge(ic, ia);
  }

  let isWatertight = true;
  for (const count of edgeCounts.values()) {
    if (count !== 2) {
      isWatertight = false;
      break;
    }
  }

  const volume = isWatertight ? Math.abs(signedVolume) : null;

  return {
    triangleCount,
    dimensions: { x: +dims.x.toFixed(2), y: +dims.y.toFixed(2), z: +dims.z.toFixed(2) },
    volume,
    surfaceArea: +surfaceArea.toFixed(2),
    isWatertight,
  };
}

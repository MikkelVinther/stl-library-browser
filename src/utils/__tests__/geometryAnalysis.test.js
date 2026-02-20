import * as THREE from 'three';
import { analyzeGeometry } from '../geometryAnalysis.js';

/**
 * Builds a tetrahedron with vertices at (0,0,0),(1,0,0),(0,1,0),(0,0,1).
 * Uses an index buffer so edges are truly shared — this mesh IS watertight.
 * Volume = 1/6 ≈ 0.1667 mm³
 */
function makeTetrahedron() {
  const positions = new Float32Array([
    0, 0, 0,  // 0
    1, 0, 0,  // 1
    0, 1, 0,  // 2
    0, 0, 1,  // 3
  ]);
  // Each pair of adjacent triangles shares exactly two vertices → every edge appears twice
  const indices = new Uint16Array([
    0, 1, 2,  // face 0 (bottom xy)
    0, 2, 3,  // face 1 (left yz)
    0, 3, 1,  // face 2 (front xz)
    1, 3, 2,  // face 3 (slanted back)
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Single non-indexed triangle — NOT watertight (each edge appears exactly once).
 */
function makeSingleTriangle() {
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}

describe('analyzeGeometry — watertight tetrahedron', () => {
  let result;
  beforeAll(() => {
    result = analyzeGeometry(makeTetrahedron());
  });

  it('reports correct triangle count (4 faces)', () => {
    expect(result.triangleCount).toBe(4);
  });

  it('reports bounding box dimensions of 1×1×1', () => {
    expect(result.dimensions.x).toBeCloseTo(1, 5);
    expect(result.dimensions.y).toBeCloseTo(1, 5);
    expect(result.dimensions.z).toBeCloseTo(1, 5);
  });

  it('detects mesh as watertight', () => {
    expect(result.isWatertight).toBe(true);
  });

  it('computes volume ≈ 1/6 for unit tetrahedron', () => {
    // V = 1/6 for tetrahedron with vertices at unit axis points
    expect(result.volume).toBeCloseTo(1 / 6, 4);
  });

  it('computes positive surface area', () => {
    expect(result.surfaceArea).toBeGreaterThan(0);
    // 3 right-angle faces (area=0.5 each) + 1 slanted face (area=√3/2 ≈ 0.866)
    expect(result.surfaceArea).toBeCloseTo(1.5 + Math.sqrt(3) / 2, 1);
  });
});

describe('analyzeGeometry — single non-watertight triangle', () => {
  let result;
  beforeAll(() => {
    result = analyzeGeometry(makeSingleTriangle());
  });

  it('reports 1 triangle', () => {
    expect(result.triangleCount).toBe(1);
  });

  it('detects mesh as NOT watertight', () => {
    expect(result.isWatertight).toBe(false);
  });

  it('returns null volume for non-watertight mesh', () => {
    expect(result.volume).toBeNull();
  });

  it('still computes bounding box and surface area', () => {
    expect(result.dimensions).toBeDefined();
    expect(result.surfaceArea).toBeGreaterThan(0);
  });
});

describe('analyzeGeometry — dimensions format', () => {
  it('rounds dimensions to 2 decimal places', () => {
    const result = analyzeGeometry(makeTetrahedron());
    // Result already rounded via toFixed(2)
    const decimals = (n) => (n.toString().split('.')[1] || '').length;
    expect(decimals(result.dimensions.x)).toBeLessThanOrEqual(2);
    expect(decimals(result.dimensions.y)).toBeLessThanOrEqual(2);
    expect(decimals(result.dimensions.z)).toBeLessThanOrEqual(2);
  });
});

import * as THREE from 'three';
import type { BufferGeometry, Scene, PerspectiveCamera, Mesh, MeshStandardMaterial } from 'three';

// ── Named constants for shared appearance values ──────────────────────────────

export const MESH_COLOR = 0x6090c0;
export const MESH_METALNESS = 0.3;
export const MESH_ROUGHNESS = 0.55;

const AMBIENT_COLOR = 0x404060;
const FILL_COLOR = 0x4a7aaa;
const RIM_COLOR = 0x3366ff;

/** STL files use Z-up; Three.js uses Y-up. */
const Z_UP_FIX = -Math.PI / 2;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PreparedScene {
  scene: Scene;
  camera: PerspectiveCamera;
  mesh: Mesh;
  geo: BufferGeometry;
  material: MeshStandardMaterial;
  dist: number;
}

// ── Shared setup helpers ──────────────────────────────────────────────────────

/**
 * Clone geometry, apply Z→Y rotation, centre it, create a mesh with the
 * standard blue material, and position the camera to fit the model.
 */
export function prepareScene(geometry: BufferGeometry, aspectRatio: number): PreparedScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.01, 10000);

  const material = new THREE.MeshStandardMaterial({
    color: MESH_COLOR,
    metalness: MESH_METALNESS,
    roughness: MESH_ROUGHNESS,
  });

  const geo = geometry.clone();
  geo.computeVertexNormals();
  geo.rotateX(Z_UP_FIX);

  const mesh = new THREE.Mesh(geo, material);

  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox!.getCenter(center);
  mesh.position.sub(center);

  const size = new THREE.Vector3();
  geo.boundingBox!.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = camera.fov * (Math.PI / 180);
  const dist = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.6;

  camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
  camera.lookAt(0, 0, 0);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  scene.add(mesh);
  return { scene, camera, mesh, geo, material, dist };
}

/**
 * Add the standard 4-light rig: ambient + key + fill + rim.
 * Call after prepareScene() with the returned `dist`.
 */
export function addStandardLighting(scene: Scene, dist: number): void {
  scene.add(new THREE.AmbientLight(AMBIENT_COLOR, 1.0));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(1, 1.5, 1).normalize().multiplyScalar(dist * 2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(FILL_COLOR, 0.5);
  fillLight.position.set(-1, 0.5, -0.5).normalize().multiplyScalar(dist * 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(RIM_COLOR, 0.3);
  rimLight.position.set(0, -1, -1).normalize().multiplyScalar(dist * 2);
  scene.add(rimLight);
}

/** Dispose GPU resources created by prepareScene(). */
export function disposePreparedScene({ material, geo }: Pick<PreparedScene, 'material' | 'geo'>): void {
  material.dispose();
  geo.dispose();
}

import * as THREE from 'three';
import type { BufferGeometry, WebGLRenderer } from 'three';
import { prepareScene, addStandardLighting, disposePreparedScene } from './threeSceneSetup';

const SIZE = 400;
let renderer: WebGLRenderer | null = null;

function getRenderer(): WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  }
  return renderer;
}

/** Release the shared WebGL renderer after a large import batch completes. */
export function disposeRenderer(): void {
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}

export function renderThumbnail(geometry: BufferGeometry): string {
  const gl = getRenderer();
  const { scene, camera, dist, ...rest } = prepareScene(geometry, 1);
  addStandardLighting(scene, dist);

  gl.render(scene, camera);
  const dataUrl = gl.domElement.toDataURL('image/png');

  disposePreparedScene(rest);
  return dataUrl;
}

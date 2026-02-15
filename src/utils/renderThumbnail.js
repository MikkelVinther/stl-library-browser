import * as THREE from 'three';

const SIZE = 400;
let renderer = null;

function getRenderer() {
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

export function renderThumbnail(geometry) {
  const gl = getRenderer();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);

  const material = new THREE.MeshStandardMaterial({
    color: 0x6090c0,
    metalness: 0.3,
    roughness: 0.55,
  });

  const geo = geometry.clone();
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);

  // Center
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox.getCenter(center);
  mesh.position.sub(center);

  // Fit camera
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.6;

  camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
  camera.lookAt(0, 0, 0);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  scene.add(mesh);

  // Lighting
  scene.add(new THREE.AmbientLight(0x404060, 1.0));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(1, 1.5, 1).normalize().multiplyScalar(dist * 2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4a7aaa, 0.5);
  fillLight.position.set(-1, 0.5, -0.5).normalize().multiplyScalar(dist * 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x3366ff, 0.3);
  rimLight.position.set(0, -1, -1).normalize().multiplyScalar(dist * 2);
  scene.add(rimLight);

  gl.render(scene, camera);
  const dataUrl = gl.domElement.toDataURL('image/png');

  // Cleanup
  material.dispose();
  geo.dispose();

  return dataUrl;
}

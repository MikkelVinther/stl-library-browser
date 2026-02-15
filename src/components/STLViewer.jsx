import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function STLViewer({ geometry, interactive = false, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !geometry) return;

    const container = containerRef.current;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 10000);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Material
    const material = new THREE.MeshStandardMaterial({
      color: 0x6090c0,
      metalness: 0.3,
      roughness: 0.55,
    });

    // Clone and prepare geometry
    const geo = geometry.clone();
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);

    // Center model at origin
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    mesh.position.sub(center);

    // Calculate camera distance to fit the model
    const size = new THREE.Vector3();
    bbox.getSize(size);
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

    // Orbit controls for interactive mode
    let controls = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
    }

    // Animation loop
    let animId = null;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!interactive) {
        mesh.rotation.y += 0.01;
      }
      if (controls) controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handling
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      ro.disconnect();
      if (controls) controls.dispose();
      renderer.dispose();
      material.dispose();
      geo.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [geometry, interactive]);

  if (!geometry) return null;

  return <div ref={containerRef} className={className} />;
}

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { BufferGeometry } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { prepareScene, addStandardLighting, disposePreparedScene } from '../utils/threeSceneSetup';

interface STLViewerProps {
  geometry: BufferGeometry | null;
  interactive?: boolean;
  className?: string;
}

export default function STLViewer({ geometry, interactive = false, className = '' }: STLViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !geometry) return;

    const container = containerRef.current;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const { scene, camera, mesh, dist, ...rest } = prepareScene(geometry, width / height);
    addStandardLighting(scene, dist);

    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
    }

    let animId: number | null = null;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!interactive) mesh.rotation.y += 0.01;
      if (controls) controls.update();
      renderer.render(scene, camera);
    };
    animate();

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
      disposePreparedScene(rest);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [geometry, interactive]);

  if (!geometry) return null;
  return <div ref={containerRef} className={className} />;
}

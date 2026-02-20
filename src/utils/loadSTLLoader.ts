/**
 * Memoized dynamic import for STLLoader.
 * Using a shared loader prevents Vite from bundling three/examples into the main chunk
 * and ensures the module is fetched and instantiated exactly once.
 */

type STLLoaderModule = typeof import('three/examples/jsm/loaders/STLLoader.js');

let cached: Promise<STLLoaderModule> | null = null;

export function loadSTLLoader(): Promise<STLLoaderModule> {
  return cached ??= import('three/examples/jsm/loaders/STLLoader.js');
}

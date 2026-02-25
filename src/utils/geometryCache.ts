import type { BufferGeometry } from 'three';
import { loadSTLLoader } from './loadSTLLoader';
import { readFile } from './electronBridge';
import { toArrayBuffer } from './bufferUtils';

interface CacheEntry {
  promise: Promise<BufferGeometry> | null;
  geometry: BufferGeometry | null;
  owners: Set<string>; // scene object IDs using this file's geometry
}

// Semaphore for limiting parallel geometry loads.
// Module-level so all cache instances share the same concurrency limit.
// Known limitation: after scene close, in-flight and queued loads continue
// to execute, occupying semaphore slots. Resolved geometries for closed
// scenes are disposed at resolve time.
function makeSemaphore(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = () => {
        running++;
        fn().then(resolve, reject).finally(() => {
          running--;
          if (queue.length > 0) queue.shift()!();
        });
      };
      if (running < concurrency) execute();
      else queue.push(execute);
    });
  };
}

const loadSemaphore = makeSemaphore(4);

export class GeometryCache {
  private entries = new Map<string, CacheEntry>();

  /** Register an object as an owner of a fileId's geometry. Idempotent. */
  addOwner(fileId: string, objectId: string): void {
    let entry = this.entries.get(fileId);
    if (!entry) {
      entry = { promise: null, geometry: null, owners: new Set() };
      this.entries.set(fileId, entry);
    }
    entry.owners.add(objectId);
  }

  /**
   * Unregister an object as an owner. If no owners remain:
   * - If geometry is loaded and no promise pending: dispose + delete entry.
   * - If promise is pending: leave entry alive so resolve handler can dispose.
   * Returns true if geometry was disposed.
   */
  removeOwner(fileId: string, objectId: string): boolean {
    const entry = this.entries.get(fileId);
    if (!entry) return false;

    entry.owners.delete(objectId);
    if (entry.owners.size > 0) return false;

    // Last owner removed
    if (entry.promise) {
      // Load still in flight — leave entry so resolve handler can dispose.
      // The resolve handler checks owners.size === 0 and disposes.
      return false;
    }

    // No pending load — dispose now
    if (entry.geometry) {
      entry.geometry.dispose();
      this.entries.delete(fileId);
      return true;
    }

    // No geometry and no promise — just clean up
    this.entries.delete(fileId);
    return false;
  }

  /** Return cached geometry immediately, or null if not yet loaded. */
  getImmediate(fileId: string): BufferGeometry | null {
    return this.entries.get(fileId)?.geometry ?? null;
  }

  /**
   * Return a promise for the geometry. Deduplicates concurrent loads for the
   * same fileId. Resolve handler auto-disposes if no owners remain.
   */
  getOrLoad(fileId: string, filePath: string): Promise<BufferGeometry> {
    const existing = this.entries.get(fileId);
    if (existing?.promise) return existing.promise;
    if (existing?.geometry) return Promise.resolve(existing.geometry);

    const promise = loadSemaphore(async () => {
      const { STLLoader } = await loadSTLLoader();
      const buffer = await readFile(filePath);
      if (!buffer) throw new Error(`readFile returned null for ${filePath}`);
      const loader = new STLLoader();
      const geo = loader.parse(toArrayBuffer(buffer));
      geo.computeVertexNormals();
      geo.rotateX(-Math.PI / 2); // Z-up (STL) -> Y-up (Three.js)

      // Center X/Z so gizmo appears at the visual horizontal center.
      // Set Y so the model's bottom face sits at y=0 (ground plane).
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const cx = (bb.max.x + bb.min.x) / 2;
      const cz = (bb.max.z + bb.min.z) / 2;
      geo.translate(-cx, -bb.min.y, -cz);

      return geo;
    });

    // Ensure entry exists (addOwner may have already created it)
    let entry = this.entries.get(fileId);
    if (!entry) {
      entry = { promise: null, geometry: null, owners: new Set() };
      this.entries.set(fileId, entry);
    }
    entry.promise = promise;

    promise.then((geo) => {
      const e = this.entries.get(fileId);
      if (!e) {
        // Entry removed by disposeAll — dispose the orphaned geometry
        geo.dispose();
        return;
      }
      e.promise = null;
      if (e.owners.size > 0) {
        e.geometry = geo;
      } else {
        // No owners remain — dispose immediately to avoid leak
        geo.dispose();
        this.entries.delete(fileId);
      }
    }).catch(() => {
      const e = this.entries.get(fileId);
      if (!e) return;
      e.promise = null;
      if (e.owners.size === 0) {
        this.entries.delete(fileId);
      }
    });

    return promise;
  }

  /** Register ownership for pre-existing objects (opened from DB). Idempotent. */
  hydrateOwners(objects: Array<{ id: string; fileId: string }>): void {
    for (const obj of objects) {
      this.addOwner(obj.fileId, obj.id);
    }
  }

  /** Dispose all cached geometries and clear the map. */
  disposeAll(): void {
    for (const entry of this.entries.values()) {
      entry.geometry?.dispose();
    }
    this.entries.clear();
  }

  // -- Test helpers (not for production use) --

  /** @internal */
  _getEntry(fileId: string): CacheEntry | undefined {
    return this.entries.get(fileId);
  }

  /** @internal */
  _size(): number {
    return this.entries.size;
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BufferGeometry } from 'three';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReadFile = vi.fn();
vi.mock('../electronBridge.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

/** Creates a mock geometry stub with a `dispose` spy. */
function makeGeoStub(): BufferGeometry {
  return {
    dispose: vi.fn(),
    computeVertexNormals: vi.fn(),
    rotateX: vi.fn(),
    computeBoundingBox: vi.fn(),
    translate: vi.fn(),
    boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
  } as unknown as BufferGeometry;
}

let geoStubQueue: BufferGeometry[] = [];
const mockParse = vi.fn(() => {
  if (geoStubQueue.length > 0) return geoStubQueue.shift()!;
  return makeGeoStub();
});

vi.mock('../loadSTLLoader.js', () => ({
  loadSTLLoader: () => Promise.resolve({
    STLLoader: class {
      parse() { return mockParse(); }
    },
  }),
}));

vi.mock('../bufferUtils.js', () => ({
  toArrayBuffer: (buf: unknown) => buf,
}));

// ── Import after mocks ───────────────────────────────────────────────────────

const { GeometryCache } = await import('../geometryCache');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GeometryCache', () => {
  let cache: InstanceType<typeof GeometryCache>;

  beforeEach(() => {
    cache = new GeometryCache();
    geoStubQueue = [];
    mockReadFile.mockResolvedValue(new ArrayBuffer(8));
    mockParse.mockClear();
  });

  // 1. Single-owner lifecycle
  it('disposes geometry when the sole owner is removed', async () => {
    const geo = makeGeoStub();
    geoStubQueue.push(geo);

    cache.addOwner('file-a', 'obj-1');
    const promise = cache.getOrLoad('file-a', '/path/a.stl');
    await promise;

    expect(cache._getEntry('file-a')?.geometry).toBe(geo);

    const disposed = cache.removeOwner('file-a', 'obj-1');
    expect(disposed).toBe(true);
    expect(geo.dispose).toHaveBeenCalledOnce();
    expect(cache._size()).toBe(0);
  });

  // 2. Shared ownership — remove first owner doesn't dispose, remove second does
  it('retains geometry until the last shared owner is removed', async () => {
    const geo = makeGeoStub();
    geoStubQueue.push(geo);

    cache.addOwner('file-a', 'obj-1');
    cache.addOwner('file-a', 'obj-2');
    await cache.getOrLoad('file-a', '/path/a.stl');

    const disposedFirst = cache.removeOwner('file-a', 'obj-1');
    expect(disposedFirst).toBe(false);
    expect(geo.dispose).not.toHaveBeenCalled();
    expect(cache._getEntry('file-a')?.geometry).toBe(geo);

    const disposedSecond = cache.removeOwner('file-a', 'obj-2');
    expect(disposedSecond).toBe(true);
    expect(geo.dispose).toHaveBeenCalledOnce();
    expect(cache._size()).toBe(0);
  });

  // 3. Pending-load removal — geometry disposed on resolve
  it('disposes geometry on resolve when last owner was removed during load', async () => {
    const geo = makeGeoStub();
    geoStubQueue.push(geo);

    cache.addOwner('file-a', 'obj-1');
    const promise = cache.getOrLoad('file-a', '/path/a.stl');

    // Remove owner while load is still pending
    cache.removeOwner('file-a', 'obj-1');

    // Promise resolves — geometry should be disposed, entry cleared
    await promise;
    expect(geo.dispose).toHaveBeenCalledOnce();
    expect(cache._size()).toBe(0);
  });

  // 4. Pending-load removal + re-add before resolve — geometry kept
  it('keeps geometry when a new owner is added before pending load resolves', async () => {
    const geo = makeGeoStub();
    geoStubQueue.push(geo);

    cache.addOwner('file-a', 'obj-1');
    const promise = cache.getOrLoad('file-a', '/path/a.stl');

    // Remove original owner
    cache.removeOwner('file-a', 'obj-1');
    // Add new owner before resolve
    cache.addOwner('file-a', 'obj-2');

    await promise;
    expect(geo.dispose).not.toHaveBeenCalled();
    expect(cache._getEntry('file-a')?.geometry).toBe(geo);
    expect(cache._getEntry('file-a')?.owners.has('obj-2')).toBe(true);
  });

  // 5. Cache deduplication — same fileId only parses once
  it('deduplicates concurrent loads for the same fileId', async () => {
    cache.addOwner('file-a', 'obj-1');
    cache.addOwner('file-a', 'obj-2');

    const p1 = cache.getOrLoad('file-a', '/path/a.stl');
    const p2 = cache.getOrLoad('file-a', '/path/a.stl');

    expect(p1).toBe(p2);

    const [g1, g2] = await Promise.all([p1, p2]);
    expect(g1).toBe(g2);
    expect(mockParse).toHaveBeenCalledOnce();
  });

  // 6. Error path cleanup — allows retry
  it('clears promise on error and allows retry', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('read failed'));

    cache.addOwner('file-a', 'obj-1');
    const p1 = cache.getOrLoad('file-a', '/path/a.stl');
    await expect(p1).rejects.toThrow('read failed');

    // Entry still exists (has owner), promise cleared
    const entry = cache._getEntry('file-a');
    expect(entry).toBeDefined();
    expect(entry?.promise).toBeNull();
    expect(entry?.geometry).toBeNull();

    // Retry succeeds
    const geo = makeGeoStub();
    geoStubQueue.push(geo);
    mockReadFile.mockResolvedValueOnce(new ArrayBuffer(8));

    const p2 = cache.getOrLoad('file-a', '/path/a.stl');
    expect(p2).not.toBe(p1);
    await p2;
    expect(cache._getEntry('file-a')?.geometry).toBe(geo);
  });

  // 7. disposeAll during pending load — geometry disposed on resolve
  it('disposes orphaned geometry when disposeAll was called before resolve', async () => {
    const geo = makeGeoStub();
    geoStubQueue.push(geo);

    cache.addOwner('file-a', 'obj-1');
    const promise = cache.getOrLoad('file-a', '/path/a.stl');

    cache.disposeAll();
    expect(cache._size()).toBe(0);

    // Promise resolves after disposeAll — geometry should be disposed
    await promise;
    expect(geo.dispose).toHaveBeenCalledOnce();
  });

  // 8. Idempotent addOwner
  it('addOwner is idempotent — same objectId counted once', () => {
    cache.addOwner('file-a', 'obj-1');
    cache.addOwner('file-a', 'obj-1');

    expect(cache._getEntry('file-a')?.owners.size).toBe(1);
  });

  // 9. Double removeOwner (StrictMode simulation) — disposes at most once
  it('double removeOwner disposes geometry at most once', async () => {
    const geo = makeGeoStub();
    geoStubQueue.push(geo);

    cache.addOwner('file-a', 'obj-1');
    await cache.getOrLoad('file-a', '/path/a.stl');

    cache.removeOwner('file-a', 'obj-1');
    cache.removeOwner('file-a', 'obj-1'); // second call — no-op

    expect(geo.dispose).toHaveBeenCalledOnce();
  });

  // 10. hydrateOwners correctness
  it('hydrateOwners seeds owners for multiple objects sharing a fileId', () => {
    cache.hydrateOwners([
      { id: 'obj-1', fileId: 'file-a' },
      { id: 'obj-2', fileId: 'file-a' },
      { id: 'obj-3', fileId: 'file-b' },
    ]);

    const entryA = cache._getEntry('file-a');
    expect(entryA?.owners.size).toBe(2);
    expect(entryA?.owners.has('obj-1')).toBe(true);
    expect(entryA?.owners.has('obj-2')).toBe(true);

    const entryB = cache._getEntry('file-b');
    expect(entryB?.owners.size).toBe(1);
    expect(entryB?.owners.has('obj-3')).toBe(true);
  });

  // Bonus: getImmediate returns cached geometry or null
  it('getImmediate returns geometry when loaded, null otherwise', async () => {
    expect(cache.getImmediate('file-a')).toBeNull();

    const geo = makeGeoStub();
    geoStubQueue.push(geo);
    cache.addOwner('file-a', 'obj-1');
    await cache.getOrLoad('file-a', '/path/a.stl');

    expect(cache.getImmediate('file-a')).toBe(geo);
  });

  // Bonus: error with no owners cleans up entry
  it('error with no owners deletes the entry entirely', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('fail'));

    cache.addOwner('file-a', 'obj-1');
    const promise = cache.getOrLoad('file-a', '/path/a.stl');

    // Remove owner before rejection
    cache.removeOwner('file-a', 'obj-1');

    await expect(promise).rejects.toThrow('fail');
    expect(cache._size()).toBe(0);
  });
});

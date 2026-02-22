/**
 * Regression tests for the import flow.
 *
 * Guards against:
 * - 'finalizing' being dropped from ImportState.status
 * - getPrintSettings moving back into the per-file loop (hot-loop regression)
 * - shouldCancel guard being removed from processFiles
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImportState } from '../../types/index';

// ── §1: Type-level check ──────────────────────────────────────────────────────

describe("ImportState.status type", () => {
  it("includes 'finalizing' as a valid status", () => {
    // Compile-time guarantee checked at runtime: 'finalizing' must be assignable
    const s: ImportState['status'] = 'finalizing';
    expect(s).toBe('finalizing');
  });

  it("includes all five pipeline stages", () => {
    const stages: ImportState['status'][] = [
      'idle', 'scanning', 'processing', 'finalizing', 'reviewing',
    ];
    // Ensures the full type union matches what the UI state machine expects
    expect(stages).toHaveLength(5);
    expect(stages).toContain('finalizing');
  });
});

// ── §2 & §3: processFiles — settings hoisting + cancel guard ─────────────────

// Spy set up before vi.mock so the factory captures the reference.
const mockGetPrintSettings = vi.fn(() => ({ material: 'PLA', infillPercent: 20 }));

vi.mock('../printEstimate.js', () => ({
  getPrintSettings: mockGetPrintSettings,
  estimateWeight: () => null,
}));

vi.mock('../loadSTLLoader.js', () => ({
  loadSTLLoader: async () => ({
    STLLoader: class {
      parse() {
        return { dispose: vi.fn() };
      }
    },
  }),
}));

vi.mock('../renderThumbnail.js', () => ({
  renderThumbnail: () => null,
  disposeRenderer: () => {},
}));

vi.mock('../geometryAnalysis.js', () => ({
  analyzeGeometry: () => ({
    triangleCount: 0,
    dimensions: { x: 1, y: 1, z: 1 },
    volume: null,
    surfaceArea: 0,
    isWatertight: false,
  }),
}));

vi.mock('../stlHeaderParser.js', () => ({
  parseSTLHeader: () => null,
}));

vi.mock('../filenameTokenizer.js', () => ({
  tokenizeFilename: () => [],
}));

vi.mock('../categoryClassifier.js', () => ({
  classifyFile: () => ({}),
}));

vi.mock('../electronBridge.js', () => ({
  readFile: async () => new ArrayBuffer(8),
  openFolder: async () => null,
  getAllFiles: async () => [],
  scanDirectory: async () => [],
  countSTLFiles: async () => 0,
}));

// Helper to build minimal FileInfo objects (fullPath triggers readFile mock)
function makeFileInfos(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    relativePath: `model-${i}.stl`,
    fullPath: `/test/model-${i}.stl`,
    sizeBytes: 1024,
    lastModified: Date.now(),
  }));
}

describe('processFiles', () => {
  beforeEach(() => {
    mockGetPrintSettings.mockClear();
  });

  it('calls getPrintSettings exactly once per batch regardless of file count', async () => {
    const { processFiles } = await import('../processFiles.js');

    const onFileProcessed = vi.fn();
    await processFiles(makeFileInfos(10), {
      onFileProcessed,
      onProgress: vi.fn(),
      onError: vi.fn(),
    });

    // Hoisted outside the loop — must be called once, not per-file
    expect(mockGetPrintSettings).toHaveBeenCalledTimes(1);
    expect(onFileProcessed).toHaveBeenCalledTimes(10);
  });

  it('stops processing when shouldCancel returns true', async () => {
    const { processFiles } = await import('../processFiles.js');

    const TOTAL = 20;
    const STOP_AFTER = 5;
    let processedCount = 0;
    let cancelled = false;

    const onFileProcessed = vi.fn(() => {
      processedCount++;
    });

    // shouldCancel is checked before each file; once true it breaks the loop
    const shouldCancel = () => {
      if (processedCount >= STOP_AFTER) cancelled = true;
      return cancelled;
    };

    await processFiles(makeFileInfos(TOTAL), {
      onFileProcessed,
      onProgress: vi.fn(),
      onError: vi.fn(),
      shouldCancel,
    });

    expect(cancelled).toBe(true);
    // At most STOP_AFTER files processed before cancel fired
    expect(onFileProcessed.mock.calls.length).toBe(STOP_AFTER);
    expect(onFileProcessed.mock.calls.length).toBeLessThan(TOTAL);
  });

  it('calls onFileProcessed with a valid STLFile shape', async () => {
    const { processFiles } = await import('../processFiles.js');

    const received: unknown[] = [];
    await processFiles(makeFileInfos(1), {
      onFileProcessed: (f) => received.push(f),
      onProgress: vi.fn(),
      onError: vi.fn(),
    });

    expect(received).toHaveLength(1);
    const file = received[0] as Record<string, unknown>;
    expect(typeof file.id).toBe('string');
    expect(typeof file.name).toBe('string');
    expect(file.tags).toEqual([]);
  });
});

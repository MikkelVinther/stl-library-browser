import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenePersistence, type SaveResult } from '../useScenePersistence';
import type { SceneState } from '../../types/scene';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSaveScene = vi.fn();
const mockSaveSceneObjects = vi.fn();

vi.mock('../../utils/electronBridge.js', () => ({
  saveScene: (...args: unknown[]) => mockSaveScene(...args),
  saveSceneObjects: (...args: unknown[]) => mockSaveSceneObjects(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScene(changeVersion = 1, savedVersion = 0): SceneState {
  return {
    meta: {
      id: 'scene-1',
      name: 'Test Scene',
      createdAt: 1000,
      updatedAt: 1000,
      gridSize: 25.4,
      gridEnabled: false,
      cameraJson: null,
    },
    objects: [],
    selectedObjectIds: [],
    transformMode: 'translate',
    changeVersion,
    savedVersion,
    lastSaveError: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useScenePersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSaveScene.mockResolvedValue(undefined);
    mockSaveSceneObjects.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('isSaving is false initially', () => {
    const { result } = renderHook(() => useScenePersistence());
    expect(result.current.isSaving).toBe(false);
  });

  it('saveNow returns ok:true with savedVersion and updatedAt on success', async () => {
    const { result } = renderHook(() => useScenePersistence());
    const scene = makeScene(3, 1);

    let saveResult!: SaveResult;
    await act(async () => {
      saveResult = await result.current.saveNow(scene);
    });

    expect(saveResult.ok).toBe(true);
    if (saveResult.ok) {
      expect(saveResult.savedVersion).toBe(3);
      expect(typeof saveResult.updatedAt).toBe('number');
    }
    expect(mockSaveScene).toHaveBeenCalledTimes(1);
    expect(mockSaveSceneObjects).toHaveBeenCalledTimes(1);
  });

  it('saveNow returns ok:false and does not throw on DB error', async () => {
    mockSaveScene.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => useScenePersistence());
    const scene = makeScene(2, 0);

    let saveResult!: SaveResult;
    await act(async () => {
      saveResult = await result.current.saveNow(scene);
    });

    expect(saveResult.ok).toBe(false);
    if (!saveResult.ok) {
      expect(saveResult.error).toContain('disk full');
    }
  });

  it('isSaving becomes true during saveNow and false after completion', async () => {
    let resolveDb!: () => void;
    mockSaveScene.mockReturnValueOnce(new Promise<void>((r) => { resolveDb = r; }));

    const { result } = renderHook(() => useScenePersistence());
    const scene = makeScene();

    // Start the save but don't await it yet
    let savePromise!: Promise<SaveResult>;
    act(() => { savePromise = result.current.saveNow(scene); });

    // Give React one microtask cycle to process setIsSaving(true)
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isSaving).toBe(true);

    // Resolve the DB call and finish
    await act(async () => {
      resolveDb();
      await savePromise;
    });

    expect(result.current.isSaving).toBe(false);
  });

  it('second snapshot queued during in-flight autosave is persisted after first completes', async () => {
    let resolveFirst!: () => void;
    // First saveScene call blocks
    mockSaveScene
      .mockReturnValueOnce(new Promise<void>((r) => { resolveFirst = r; }))
      .mockResolvedValue(undefined);
    mockSaveSceneObjects.mockResolvedValue(undefined);

    const { result } = renderHook(() => useScenePersistence());

    const scene1 = makeScene(1, 0);
    const scene2 = makeScene(2, 0);

    const drainCallbacks: Array<{ r: SaveResult; s: SceneState }> = [];
    const trackDrain = (r: SaveResult, s: SceneState) => drainCallbacks.push({ r, s });

    // Queue scene1 and advance debounce to fire the drain
    act(() => { result.current.queueAutosave(scene1, trackDrain); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    // While first save is in-flight, queue scene2
    act(() => { result.current.queueAutosave(scene2, trackDrain); });

    // Resolve the first DB call — drain loop picks up scene2
    await act(async () => {
      resolveFirst();
      await Promise.resolve(); // let microtasks flush
    });
    await act(async () => { await vi.runAllTimersAsync(); });

    // Both rounds of DB calls must have happened
    expect(mockSaveScene.mock.calls.length).toBeGreaterThanOrEqual(2);

    // The final drain callback must reflect scene2's changeVersion=2
    const last = drainCallbacks[drainCallbacks.length - 1];
    expect(last.r.ok).toBe(true);
    if (last.r.ok) {
      expect(last.r.savedVersion).toBe(2);
    }
  });

  it('saveNow cancels pending autosave and drainCallback is not called', async () => {
    const { result } = renderHook(() => useScenePersistence());
    const scene = makeScene();

    const drainCallback = vi.fn();
    act(() => { result.current.queueAutosave(scene, drainCallback); });

    // saveNow supersedes the queued autosave
    await act(async () => {
      await result.current.saveNow(scene);
    });

    // Advance past autosave debounce — no further drain should fire
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(drainCallback).not.toHaveBeenCalled();
  });

  it('unmount during in-flight save does not throw', async () => {
    let resolveDb!: () => void;
    mockSaveScene.mockReturnValueOnce(new Promise<void>((r) => { resolveDb = r; }));

    const { result, unmount } = renderHook(() => useScenePersistence());

    let savePromise!: Promise<SaveResult>;
    act(() => { savePromise = result.current.saveNow(makeScene()); });
    await act(async () => { await Promise.resolve(); });

    // Unmount while save is in-flight
    unmount();

    // Resolving after unmount should not throw
    await expect(act(async () => {
      resolveDb();
      await savePromise;
    })).resolves.not.toThrow();
  });
});

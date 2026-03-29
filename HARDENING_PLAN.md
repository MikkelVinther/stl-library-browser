# Immediate Risk Hardening Plan (R3F + Electron + Performance)

## Summary
Implement a 6-part hardening pass focused on immediate correctness, security, and performance risks already identified in the current codebase.

Priority order:
1. Fix scene geometry ownership coupling to state updater timing (StrictMode + maintainability).
2. Fix async viewer load race/leak on modal close.
3. Add main-process filesystem path policy (defense-in-depth).
4. Remove O(n×m) selection lookups in hot render paths.
5. Remove cross-scene geometry load queue contention.
6. Reduce initial bundle cost with lazy boundaries for 3D-heavy UI.

## Public API / Interface Changes
| Area | Change | Files |
|---|---|---|
| Scene object operations | Change `removeObject` to accept object context (`id` + `fileId`) instead of deriving `fileId` inside state updater. | [useSceneObjects.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/hooks/useSceneObjects.ts), [SceneBuilder.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneBuilder.tsx) |
| Scene object operations | Change `duplicateObject` to accept source object context (or `id+fileId+transform`) from caller, removing cache-side dependency on updater timing. | [useSceneObjects.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/hooks/useSceneObjects.ts), [SceneBuilder.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneBuilder.tsx) |
| Scene object operations | Add batch `duplicateObjects(ids)` that performs a single `setScene` call instead of N sequential updates. | [useSceneObjects.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/hooks/useSceneObjects.ts), [SceneBuilder.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneBuilder.tsx) |
| Security boundary | Add main-process-only path policy helper and enforce it in IPC file handlers. | [main.cjs](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/electron/main.cjs), [filesystem.cjs](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/electron/filesystem.cjs), new `electron/pathPolicy.cjs`, [database.cjs](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/electron/database.cjs) |

## Implementation Workstreams

### 1) Fix geometry cache coupling in `useSceneObjects` (P1)

The primary risk here is **React StrictMode double-invocation** in development and long-term maintainability — not production async races, since React 18 processes `setState` updaters synchronously in event handlers. However, the coupling between state updater internals and external cache mutations is fragile and must be eliminated.

1. Refactor `removeObject` so it no longer depends on a `fileId` captured from a state updater side-channel. Caller must provide `id` + `fileId` directly.
2. Refactor `duplicateObject` the same way; ownership writes must be driven by caller-provided source object data.
3. Refactor `addObject` ownership ordering: currently `cache.addOwner()` is called *before* `setScene()`, meaning a failed or interrupted state update leaves the cache with an owner for a non-existent scene object. Move `addOwner` to the post-update flow, or document this ordering as intentionally acceptable with a clear comment.
4. Add a batch `duplicateObjects(ids)` function that collects all duplications into a single `setScene` call. The current loop in `SceneBuilder.tsx` calls `duplicateObject()` N times for N selected objects, triggering N separate state updates and re-renders.
5. Keep state updaters pure and deterministic; keep cache mutations outside updaters, but driven by known inputs (not updater timing).
6. Update all callsites in `SceneBuilder` keyboard handlers and button actions to pass object context directly.
7. Add a mounted ref or cleanup flag to prevent `setSceneState` calls from in-flight `loadGeometryForObject` promises that resolve after the scene component unmounts.
8. Keep current `GeometryCache` ownership semantics and tests intact; only remove updater-timing coupling.

Implementation files:
- [useSceneObjects.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/hooks/useSceneObjects.ts)
- [SceneBuilder.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneBuilder.tsx)

Acceptance criteria:
1. No cache mutation relies on variables written inside `setScene((prev)=>...)`.
2. State updaters are safe under React StrictMode double-invocation (no duplicated side effects).
3. Removing/duplicating objects in rapid sequences leaves cache owners consistent.
4. Duplicating N selected objects triggers a single `setScene` update, not N updates.
5. Unmounting the scene component while geometry loads are in-flight does not call `setSceneState` after unmount.
6. Existing geometry cache tests still pass.

---

### 2) Fix `useFileDetail` async race/leak on close (P2)
1. Add request version counter (or `AbortController`) in `handleLoad3D` to ignore stale completions. Note: `electronBridge.readFile` returns a `Buffer | null` via IPC and cannot itself be aborted — the token guards the post-read parse and state update.
2. Increment token on `openFile` and `closeFile` so in-flight work becomes obsolete.
3. If stale completion occurs after parse, dispose parsed geometry immediately and skip state update.
4. Before setting a new loaded geometry, dispose any previous loaded geometry held in state — not just in `closeFile`. This handles the case where the user switches files without closing the modal (if that path exists or is added later).

Implementation files:
- [useFileDetail.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/hooks/useFileDetail.ts)

Acceptance criteria:
1. Closing modal during loading does not leave geometry alive.
2. Reopening a different file while prior load is in flight never shows wrong model.
3. Viewer state cannot transition to `loaded` from a stale request.
4. Switching files without closing the modal disposes the previous geometry before setting the new one.

---

### 3) Add filesystem path policy in Electron IPC (P2, security)
1. Introduce `electron/pathPolicy.cjs` with canonicalization and subpath checks.
2. Maintain `approvedRoots` in main process.
3. Seed `approvedRoots` from the `directories` table in the database at app startup, so previously-imported folders remain accessible across sessions.
4. On `dialog:openFolder`, canonicalize selected directory and add it to `approvedRoots`.
5. **Symlink resolution timing:** Always `fs.realpathSync` the *requested path* at validation time (not just at registration time), since symlinks can change after a root is approved. Approved roots may be cached in canonical form, but request paths must be resolved fresh each time.
6. Enforce policy on `fs:scanDirectory`, `fs:countSTLFiles`, `fs:readFile`:
   - Requested path must be within an approved root after canonicalization.
   - `readFile` also requires `.stl` extension.
7. Denied access must fail closed and log a clear policy denial reason.
8. In import processing, prefer `_browserFile.arrayBuffer()` over main-process `readFile` for dropped files to avoid unnecessary path-based reads. Note: the file detail modal's 3D viewer will still use `readFile` with stored paths — this is expected and must remain functional for files within approved roots.

Implementation files:
- [main.cjs](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/electron/main.cjs)
- [filesystem.cjs](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/electron/filesystem.cjs)
- [database.cjs](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/electron/database.cjs) — for seeding `approvedRoots` from the `directories` table at startup
- new `electron/pathPolicy.cjs`
- [processFiles.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/utils/processFiles.ts)

Acceptance criteria:
1. Arbitrary renderer-supplied paths outside approved roots are rejected.
2. Normal folder import flow still works.
3. Drag/drop import still works even when file path is outside approved roots.
4. Symlink-based path traversal attacks are blocked (request paths are resolved at validation time).
5. Previously-imported directories are accessible after app restart (seeded from DB).

---

### 4) Remove O(n×m) selection lookups in hot render paths (P3)

Swapped with former Workstream 5 (semaphore isolation) since this has more direct user-facing impact than the transient semaphore contention.

1. Create a memoized `Set` from `selectedObjectIds` via `useMemo` in the parent component that owns `selectedObjectIds`, and pass the `Set` down to children. Avoid creating multiple `Set` instances in each child.
2. Replace repeated `includes` checks with `Set.has` in `SceneObjectGroup.tsx` and `SceneObjectList.tsx`.
3. Add `React.memo` to `SceneObjectList` (currently unwrapped), since it re-renders on every selection change even for unchanged items.
4. Optimize scene copy path by using a `Set` for selected IDs before filtering objects.

Implementation files:
- [SceneObjectGroup.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneObjectGroup.tsx)
- [SceneObjectList.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneObjectList.tsx)
- [SceneBuilder.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/scene/SceneBuilder.tsx)

Acceptance criteria:
1. No `selectedObjectIds.includes(...)` remains inside per-object render loops.
2. The `Set` is created once via `useMemo` in the parent, not duplicated in children.
3. `SceneObjectList` is wrapped in `React.memo`.
4. Behavior for single/multi-select and Shift/Ctrl/Cmd toggle is unchanged.

---

### 5) Remove cross-scene load queue contention (P3)

Deprioritized from former P2: the module-scoped semaphore contention is **transient and self-healing**. When a scene closes, `cache.disposeAll()` clears entries, and in-flight loads for the old scene bail out when they find their entry missing (the `if (!e)` check after acquiring the semaphore). Slots release within milliseconds. This is still worth fixing for correctness, but is unlikely to cause user-perceived starvation.

1. Move geometry load semaphore from module scope to `GeometryCache` instance scope.
2. Keep same concurrency value (4) per cache instance.
3. Preserve existing owner/dispose logic and current tests.
4. Add regression coverage proving one cache instance's in-flight workload does not block another instance.

Implementation files:
- [geometryCache.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/utils/geometryCache.ts)
- [geometryCache.test.ts](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/utils/__tests__/geometryCache.test.ts)

Acceptance criteria:
1. Each `GeometryCache` instance has its own semaphore; module-scoped semaphore is removed.
2. New test verifies semaphore isolation behavior across instances.
3. Existing geometry cache tests still pass.

---

### 6) Reduce initial bundle weight for 3D-heavy paths (P3)
1. Lazy-load `SceneBuilder` from `App` (scene mode) using `React.lazy` + `Suspense`.
2. Lazy-load `FileDetailModal` from `App` (detail mode).
3. Lazy-load `STLViewer` inside modal only when viewer is actually used.
4. Wrap each lazy component in an `ErrorBoundary` in addition to `Suspense`. If a lazy chunk fails to load (corrupt chunk, disk error in Electron), `React.lazy` throws — the `ErrorBoundary` provides a recovery path instead of a white screen.
5. Keep existing `OrbitControls/TransformControls` behavior unchanged.
6. Verify Vite chunk output confirms reduced main entry chunk. Vite handles dynamic import chunking automatically — manual chunk tuning in `vite.config.js` should only be added if the build output shows unexpected chunk merging.

Implementation files:
- [App.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/App.tsx)
- [FileDetailModal.tsx](/Users/mikkelvinther/Documents/Code%20stuff/stl-library-viewer/stl-library-browser/src/components/FileDetailModal.tsx)

Acceptance criteria:
1. Main entry JS chunk decreases materially versus current build.
2. Scene mode and 3D detail mode still load correctly with expected Suspense fallbacks.
3. Lazy load failures are caught by ErrorBoundary and show a recovery UI, not a white screen.
4. No regression in modal open/close interactions.

## Test Cases and Scenarios

### Automated tests to add/update
1. Add `useSceneObjects` unit tests for remove/duplicate ownership correctness independent of updater timing, including StrictMode double-invocation safety.
2. Add `useSceneObjects` test for batch `duplicateObjects` — single state update for N duplications.
3. Add `useSceneObjects` test for unmount-during-load — `setSceneState` is not called after cleanup.
4. Add `useFileDetail` hook tests for stale async load cancellation and geometry disposal, including the switch-file-without-close scenario.
5. Extend geometry cache tests with multi-instance semaphore isolation.
6. Add unit tests for new `pathPolicy` helper:
   - allows canonical child paths under approved roots,
   - rejects prefix tricks and path traversal,
   - handles symlinks/canonicalization — request paths are resolved fresh, not cached,
   - rejects non-`.stl` extensions on `readFile`.

### Existing checks to run
1. `npm test`
2. `npm run build`

### Manual QA checklist
1. Open scene with many shared-file objects, remove/duplicate rapidly, then close/reopen scene.
2. Duplicate many selected objects at once — verify single re-render, not N.
3. Start loading 3D in file modal and close immediately; repeat with different files.
4. Attempt import/read with paths outside approved roots (should fail closed).
5. Restart app after importing directories — verify previously-imported folders are still accessible.
6. Open/close one heavy scene while opening another; verify no apparent loader starvation.
7. Validate multi-select UX and gizmo behavior remain stable.
8. Verify lazy-loaded components show Suspense fallback, then load correctly.
9. Simulate lazy chunk load failure (e.g., rename a chunk file) — verify ErrorBoundary shows recovery UI.

## Rollout Sequence
1. Land Workstreams 1 and 2 together (correctness baseline).
2. Land Workstream 3 (security hardening) with path-policy tests.
3. Land Workstreams 4 and 5 (runtime responsiveness improvements).
4. Land Workstream 6 last and confirm bundle delta + UX behavior.

## Assumptions and Defaults
1. App remains local-first, but renderer compromise is treated as a realistic defense-in-depth risk.
2. Existing scene/file schema remains unchanged; no migration required for this plan.
3. Approved root policy is based on user-chosen directories and persisted directory records (seeded from `directories` table at startup).
4. R3F controls behavior continues to rely on `OrbitControls makeDefault` + Drei's built-in TransformControls integration.
5. Electron loads bundles from disk, so lazy-loading primarily reduces V8 parse cost at startup rather than network transfer time. The benefit is real but more modest than in a web app context.

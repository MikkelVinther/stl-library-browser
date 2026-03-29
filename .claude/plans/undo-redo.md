# Undo/Redo for Scene Builder

## Summary

Add Cmd+Z / Cmd+Shift+Z undo/redo support to the scene editor. Uses a snapshot-based undo stack that captures lightweight state snapshots (no geometry) at each meaningful change boundary.

## Scope

**In scope:** `src/hooks/useUndoStack.ts` (new), `src/hooks/useSceneObjects.ts`, `src/components/scene/SceneBuilder.tsx`, `src/components/scene/SceneToolbar.tsx`, and tests.

**Out of scope:** Undo for library-level operations, undo persistence across scene close/reopen, infinite undo depth.

## Key Design Decisions

1. **Snapshot-based, not command-pattern.** SceneState is already an immutable value object — cloning it (minus geometry) is cheap and avoids the complexity of inverse operations. Stack depth capped at ~50 entries.
2. **Geometry excluded from snapshots.** Geometry lives in `GeometryCache` and is re-associated on restore via cache lookup or re-triggered load. Snapshots store only serializable data fields.
3. **Coalesced transform commits.** Gizmo drags produce many intermediate `updateTransform` calls. Only the final `onMouseUp` commit (which is what currently triggers `changeVersion`) counts as an undo step. No special coalescing logic needed — the existing commit pattern already groups drags into single state changes.
4. **Selection changes are NOT undoable.** Selection is transient UI state. Undo restores object data (positions, adds, removes, colors) but the selection at time of undo is preserved.
5. **`savedVersion` is NOT restored on undo.** Undo changes `changeVersion` (triggering autosave to persist the undone state), but `savedVersion` tracks what's been written to DB and should only advance forward.

## Types

```ts
/** SceneState with geometry stripped — safe to store in memory. */
interface SceneSnapshot {
  meta: SceneMeta;
  objects: SceneObjectData[];   // SceneObject minus geometry/loadStatus
  changeVersion: number;
}

interface UseUndoStackReturn {
  /** Push current state onto undo stack. Call BEFORE applying a mutation. */
  pushUndo: (scene: SceneState) => void;
  /** Undo: restore previous state. Returns null if stack empty. */
  undo: (current: SceneState) => SceneSnapshot | null;
  /** Redo: restore next state. Returns null if redo stack empty. */
  redo: (current: SceneState) => SceneSnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
}
```

## Implementation Plan

### 1) Create `useUndoStack` hook

**New file:** `src/hooks/useUndoStack.ts`

**Core logic:**

```
undoStack: SceneSnapshot[]   (max 50 entries, oldest dropped on overflow)
redoStack: SceneSnapshot[]   (cleared on any new push)
```

`pushUndo(scene)`:
- Strip geometry and loadStatus from each object to create `SceneSnapshot`.
- Push onto `undoStack`. Clear `redoStack` (new action invalidates redo history).
- If stack exceeds 50, shift oldest entry.

`undo(current)`:
- If `undoStack` is empty, return null.
- Push a snapshot of `current` onto `redoStack` (so the current state can be redone).
- Pop and return the top of `undoStack`.

`redo(current)`:
- If `redoStack` is empty, return null.
- Push a snapshot of `current` onto `undoStack`.
- Pop and return the top of `redoStack`.

`canUndo` / `canRedo`: derived from stack lengths.

**Stripping geometry:**
```ts
function snapshotFrom(scene: SceneState): SceneSnapshot {
  return {
    meta: scene.meta,
    objects: scene.objects.map(({ geometry, loadStatus, ...data }) => data),
    changeVersion: scene.changeVersion,
  };
}
```

**Restoring from snapshot:**
```ts
function restoreFrom(snapshot: SceneSnapshot, cache: GeometryCache, current: SceneState): SceneState {
  return {
    ...current,                          // preserve savedVersion, lastSaveError, transformMode
    meta: snapshot.meta,
    changeVersion: snapshot.changeVersion,
    objects: snapshot.objects.map((data) => ({
      ...data,
      geometry: cache.getImmediate(data.fileId),
      loadStatus: cache.getImmediate(data.fileId) ? 'loaded' : 'pending',
    })),
  };
}
```

Objects whose geometry isn't in cache (e.g., was disposed after removal) get `loadStatus: 'pending'` and will re-trigger load via `SceneObject3D`'s mount effect.

### 2) Integrate undo stack into `useSceneObjects`

**File:** `src/hooks/useSceneObjects.ts`

Add `pushUndo` calls before each state-mutating operation:
- `addObject`: push before `setScene`
- `removeObject`: push before `setScene`
- `duplicateObject`: push before `setScene`
- `pasteObject`: push before `setScene`
- `updateTransform`: push before `setScene`

**Important:** `selectObject` does NOT push to the undo stack (selection is transient).

**Approach:** Accept `pushUndo` as a parameter or expose it from the hook. Simplest: `useSceneObjects` accepts an optional `onBeforeMutate?: (scene: SceneState) => void` callback that SceneBuilder provides, wired to `pushUndo`.

However, this is awkward since `useSceneObjects` uses `setScene` functional updaters and doesn't have direct access to the current state at call time.

**Better approach:** Push undo at the SceneBuilder level, wrapping the handlers. Each handler that triggers a `changeVersion` increment calls `pushUndo(sceneState)` before the hook method:

```ts
const handleRemoveObject = useCallback((id: string) => {
  pushUndo(sceneState);
  removeObject(id, setSceneState);
}, [pushUndo, sceneState, removeObject, setSceneState]);
```

This keeps the undo logic in one place (SceneBuilder) and doesn't require modifying the hook signatures.

### 3) Integrate cache ownership on undo/redo restore

**File:** `src/components/scene/SceneBuilder.tsx`

When restoring a snapshot:
1. Compute which objects were added (in snapshot but not in current) — call `cache.addOwner` for each.
2. Compute which objects were removed (in current but not in snapshot) — call `cache.removeOwner` for each.
3. Apply the restored state via `setSceneState`.
4. For objects with `loadStatus: 'pending'`, their `SceneObject3D` mount effects will re-trigger geometry load automatically.

```ts
const applySnapshot = useCallback((snapshot: SceneSnapshot) => {
  const currentIds = new Set(sceneState.objects.map(o => o.id));
  const snapshotIds = new Set(snapshot.objects.map(o => o.id));

  // Objects being restored (were removed, now coming back)
  for (const obj of snapshot.objects) {
    if (!currentIds.has(obj.id)) {
      cache.addOwner(obj.fileId, obj.id);
    }
  }
  // Objects being removed (exist now, not in snapshot)
  for (const obj of sceneState.objects) {
    if (!snapshotIds.has(obj.id)) {
      cache.removeOwner(obj.fileId, obj.id);
    }
  }

  setSceneState(restoreFrom(snapshot, cache, sceneState));
}, [sceneState, setSceneState, cache]);
```

**Note:** `applySnapshot` needs access to the `GeometryCache` instance. Either expose it from `useSceneObjects` or pass it through. Simplest: add a `getCache()` accessor to `UseSceneObjectsReturn`.

### 4) Wire up keyboard shortcuts

**File:** `src/components/scene/SceneBuilder.tsx`

Add to the keyboard handler:

```ts
case 'z':
case 'Z':
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    if (e.shiftKey) {
      // Redo
      const snapshot = redo(sceneState);
      if (snapshot) applySnapshot(snapshot);
    } else {
      // Undo
      const snapshot = undo(sceneState);
      if (snapshot) applySnapshot(snapshot);
    }
  }
  break;
```

### 5) Add undo/redo buttons to toolbar (optional visual indicator)

**File:** `src/components/scene/SceneToolbar.tsx`

Add Undo/Redo icon buttons (Lucide `Undo2`/`Redo2`) next to the existing toolbar controls. Disabled state driven by `canUndo`/`canRedo`. This is optional — keyboard shortcuts are the primary interface.

### 6) Expose cache from useSceneObjects

**File:** `src/hooks/useSceneObjects.ts`

Add to `UseSceneObjectsReturn`:
```ts
cache: GeometryCache;
```

This gives SceneBuilder direct access for the ownership reconciliation in `applySnapshot`.

## Test Plan

### New file: `src/hooks/__tests__/useUndoStack.test.ts`

1. **Push and undo:** Push state, mutate, undo → returns previous snapshot.
2. **Redo after undo:** Undo, then redo → returns the state before undo.
3. **New push clears redo:** Undo, push new state → redo stack empty.
4. **Stack depth limit:** Push 55 states → oldest 5 are dropped, stack has 50.
5. **Undo on empty stack:** Returns null.
6. **Redo on empty stack:** Returns null.
7. **Snapshot strips geometry:** Snapshot objects have no `geometry` or `loadStatus` fields.

### Existing tests
- `npm test` — all 104+ tests pass.
- `npm run build` — no TypeScript errors.

## Manual QA

1. Add object, Cmd+Z → object removed. Cmd+Shift+Z → object restored.
2. Move object with gizmo, Cmd+Z → object returns to previous position.
3. Delete 3 objects, Cmd+Z three times → all three restored in reverse order.
4. Change color, Cmd+Z → color reverts.
5. Cmd+Z many times to empty undo stack → no crash, no-op.
6. Undo, then make a new change → redo stack cleared (can't redo past the new change).
7. Undo a delete → geometry reloads correctly (appears after brief loading state if cache was cleared).
8. Toolbar undo/redo buttons reflect enabled/disabled state correctly.

## File Change Summary

| File | Change |
|---|---|
| `src/hooks/useUndoStack.ts` | **New** — undo/redo stack with snapshot logic |
| `src/hooks/__tests__/useUndoStack.test.ts` | **New** — 7 test scenarios |
| `src/hooks/useSceneObjects.ts` | **Minor** — expose `cache` in return |
| `src/components/scene/SceneBuilder.tsx` | **Moderate** — pushUndo before mutations, applySnapshot, keyboard shortcuts |
| `src/components/scene/SceneToolbar.tsx` | **Minor** — optional undo/redo buttons |

## Assumptions

1. 50-entry stack depth is sufficient (each entry is ~1–5 KB of serializable data).
2. Geometry re-load on undo-restore is acceptable (instant if still in cache, brief loading flash if disposed).
3. Autosave treats undone state as a new change to persist (correct behavior — DB always reflects current state).

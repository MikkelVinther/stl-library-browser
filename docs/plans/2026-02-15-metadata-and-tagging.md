# STL Metadata Extraction & Tagging — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-extract metadata from STL files on import (header, filename, geometry stats, print estimates), and provide import review + bulk tagging workflows.

**Architecture:** Three pure utility modules handle extraction (geometry analysis, header parsing, filename tokenization). A new ImportReviewPanel component stages files before adding them to the library. Bulk select mode adds a selection layer over the existing grid with a floating action bar. Print settings are stored in localStorage.

**Tech Stack:** React 18, Three.js (geometry analysis), Tailwind CSS (styling), IndexedDB (persistence), localStorage (print settings)

---

### Task 1: Geometry Analysis Utility

**Files:**
- Create: `src/utils/geometryAnalysis.js`

**Step 1: Create the geometry analysis module**

This module receives a `THREE.BufferGeometry` and returns computed stats. The key algorithms:

- **Triangle count**: `position.count / 3`
- **Bounding box dimensions**: from `geometry.computeBoundingBox()`
- **Volume**: Signed tetrahedra method — for each triangle with vertices (a, b, c), accumulate `a.dot(b.cross(c)) / 6`. Valid only if mesh is watertight.
- **Surface area**: Sum of `0.5 * |AB x AC|` for each triangle
- **Watertight check**: Build an edge map; every edge should appear exactly twice (once per adjacent face)

```javascript
// src/utils/geometryAnalysis.js
import * as THREE from 'three';

export function analyzeGeometry(geometry) {
  const position = geometry.attributes.position;
  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : position.count / 3;

  // Bounding box dimensions
  geometry.computeBoundingBox();
  const dims = new THREE.Vector3();
  geometry.boundingBox.getSize(dims);

  // Compute volume, surface area, and watertight check
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  let signedVolume = 0;
  let surfaceArea = 0;
  const edgeCounts = new Map();

  const addEdge = (i1, i2) => {
    const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  };

  for (let i = 0; i < triangleCount; i++) {
    let ia, ib, ic;
    if (index) {
      ia = index.getX(i * 3);
      ib = index.getX(i * 3 + 1);
      ic = index.getX(i * 3 + 2);
    } else {
      ia = i * 3;
      ib = i * 3 + 1;
      ic = i * 3 + 2;
    }

    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);

    // Signed volume of tetrahedron with origin
    signedVolume += a.dot(ab.copy(b).cross(ac.copy(c))) / 6;

    // Triangle area
    ab.copy(b).sub(a);
    ac.copy(c).sub(a);
    surfaceArea += ab.cross(ac).length() * 0.5;

    // Edge tracking for watertight check
    addEdge(ia, ib);
    addEdge(ib, ic);
    addEdge(ic, ia);
  }

  let isWatertight = true;
  for (const count of edgeCounts.values()) {
    if (count !== 2) {
      isWatertight = false;
      break;
    }
  }

  const volume = isWatertight ? Math.abs(signedVolume) : null;

  return {
    triangleCount,
    dimensions: { x: +dims.x.toFixed(2), y: +dims.y.toFixed(2), z: +dims.z.toFixed(2) },
    volume,
    surfaceArea: +surfaceArea.toFixed(2),
    isWatertight,
  };
}
```

**Step 2: Verify manually**

Import the function in the browser console or temporarily call it in `loadSTLFiles` with a `console.log` to verify output for a test STL file. Confirm triangle count, dimensions, and watertight status look reasonable.

**Step 3: Commit**

```bash
git add src/utils/geometryAnalysis.js
git commit -m "feat: add geometry analysis utility (triangles, dimensions, volume, surface area, watertight)"
```

---

### Task 2: STL Header Parser

**Files:**
- Create: `src/utils/stlHeaderParser.js`

**Step 1: Create the header parser**

Binary STL files have an 80-byte header. ASCII STL files start with `solid <name>`. We parse both.

```javascript
// src/utils/stlHeaderParser.js

export function parseSTLHeader(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));

  // Decode as ASCII and trim null bytes
  let header = '';
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    if (ch === 0) break;
    if (ch >= 32 && ch < 127) {
      header += String.fromCharCode(ch);
    }
  }
  header = header.trim();

  // Check if ASCII STL — extract the solid name
  if (header.startsWith('solid')) {
    const name = header.slice(5).trim();
    return name.length > 0 ? name : null;
  }

  // Binary header — return if it looks meaningful (not just whitespace or gibberish)
  if (header.length < 3) return null;

  return header;
}
```

**Step 2: Commit**

```bash
git add src/utils/stlHeaderParser.js
git commit -m "feat: add STL header parser for binary and ASCII formats"
```

---

### Task 3: Filename Tokenizer

**Files:**
- Create: `src/utils/filenameTokenizer.js`

**Step 1: Create the tokenizer**

Splits filenames into candidate tags by breaking on separators and camelCase.

```javascript
// src/utils/filenameTokenizer.js

const NOISE_WORDS = new Set([
  'stl', 'obj', 'file', 'model', 'final', 'copy', 'new', 'old',
  'fixed', 'repaired', 'export', 'exported', 'print', 'ready',
]);

const VERSION_RE = /^v?\d+$/i;

export function tokenizeFilename(filename) {
  // Strip extension
  const base = filename.replace(/\.stl$/i, '');

  // Split on separators: _ - space . ( )
  // Then split camelCase: "ForestTree" -> ["Forest", "Tree"]
  const raw = base
    .split(/[_\-\s.()]+/)
    .flatMap((part) => part.split(/(?<=[a-z])(?=[A-Z])/))
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);

  // Deduplicate and filter noise
  const seen = new Set();
  const tokens = [];
  for (const token of raw) {
    if (token.length < 2) continue;
    if (VERSION_RE.test(token)) continue;
    if (NOISE_WORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}
```

**Step 2: Commit**

```bash
git add src/utils/filenameTokenizer.js
git commit -m "feat: add filename tokenizer for auto-suggesting tags"
```

---

### Task 4: Print Estimate Utility + Settings

**Files:**
- Create: `src/utils/printEstimate.js`

**Step 1: Create the print estimate module**

Handles material densities, settings persistence in localStorage, and the estimation formula.

```javascript
// src/utils/printEstimate.js

export const MATERIALS = {
  PLA:   { label: 'PLA',   density: 1.24 },
  ABS:   { label: 'ABS',   density: 1.04 },
  PETG:  { label: 'PETG',  density: 1.27 },
  TPU:   { label: 'TPU',   density: 1.21 },
  Nylon: { label: 'Nylon', density: 1.14 },
  Resin: { label: 'Resin', density: 1.15 },
};

const SETTINGS_KEY = 'stl-library-print-settings';

const DEFAULTS = { material: 'PLA', infillPercent: 20 };

export function getPrintSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function savePrintSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Estimate filament weight in grams.
 * volumeMm3: volume in mm³ (from geometry analysis, which uses model units — typically mm)
 * Returns null if volume is null (mesh not watertight).
 */
export function estimateWeight(volumeMm3, settings) {
  if (volumeMm3 == null) return null;
  const { material, infillPercent } = settings || getPrintSettings();
  const density = MATERIALS[material]?.density ?? 1.24;
  const volumeCm3 = volumeMm3 / 1000; // mm³ → cm³
  // Simplified: assume the model is infillPercent% filled
  const infillFactor = infillPercent / 100;
  return +(volumeCm3 * infillFactor * density).toFixed(1);
}
```

**Step 2: Commit**

```bash
git add src/utils/printEstimate.js
git commit -m "feat: add print estimate utility with material settings"
```

---

### Task 5: Integrate Extraction into Import Pipeline

**Files:**
- Modify: `src/App.jsx` (the `loadSTLFiles` function, lines 180–224)
- Modify: `src/utils/db.js` (bump DB version, persist metadata)

**Step 1: Update db.js to persist metadata**

Add `metadata` to the stored object. Bump DB_VERSION to 2 so existing databases get the upgrade.

```javascript
// db.js changes:
// - DB_VERSION = 2
// - In onupgradeneeded, handle migration (the store structure doesn't change since
//   metadata is just a new property on the same object — no schema change needed,
//   but bumping version ensures the upgrade handler runs for any future index needs)
```

Modify `db.js`:
- Change `DB_VERSION` from `1` to `2`
- Ensure `onupgradeneeded` creates the store only if it doesn't exist (already does this)

**Step 2: Update loadSTLFiles to extract metadata**

Instead of immediately adding files to state, `loadSTLFiles` now:
1. Parses each file and runs extraction
2. Returns the staged entries (doesn't add to state yet)
3. App.jsx stores them in a new `pendingImports` state
4. The ImportReviewPanel displays them for review
5. On "Import", they're added to state and IndexedDB

Modify `loadSTLFiles` in `App.jsx`:

```javascript
import { analyzeGeometry } from './utils/geometryAnalysis';
import { parseSTLHeader } from './utils/stlHeaderParser';
import { tokenizeFilename } from './utils/filenameTokenizer';
import { estimateWeight, getPrintSettings } from './utils/printEstimate';

// New state:
const [pendingImports, setPendingImports] = useState([]);

const loadSTLFiles = async (fileList) => {
  const loader = new STLLoader();
  const staged = [];

  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();

      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const thumbnail = renderThumbnail(geometry);
      const id = Date.now() + Math.random();

      const geoStats = analyzeGeometry(geometry);
      const headerText = parseSTLHeader(buffer);
      const suggestedTags = tokenizeFilename(file.name);
      const settings = getPrintSettings();
      const estimatedGrams = estimateWeight(geoStats.volume, settings);
      const volumeCm3 = geoStats.volume != null ? +(geoStats.volume / 1000).toFixed(2) : null;

      staged.push({
        id,
        name: file.name.replace(/\.stl$/i, '').replace(/[_-]/g, ' '),
        size: `${sizeMB} MB`,
        type: 'prop',
        tags: [],
        thumbnail,
        geometry,
        stlBuffer: buffer,
        metadata: {
          ...geoStats,
          headerText,
          originalFilename: file.name,
          suggestedTags,
          importedAt: Date.now(),
          lastModified: file.lastModified || null,
          collection: null,
          printEstimate: { volumeCm3, estimatedGrams },
        },
      });
    } catch (err) {
      console.error(`Failed to load ${file.name}:`, err);
    }
  }

  if (staged.length > 0) {
    setPendingImports(staged);
  }
};
```

**Step 3: Add confirmImport and cancelImport functions**

```javascript
const confirmImport = (reviewedFiles) => {
  // Add to state
  setFiles((prev) => [...reviewedFiles, ...prev]);
  // Persist each to IndexedDB (without geometry, with stlBuffer)
  reviewedFiles.forEach((f) => {
    const { geometry, stlBuffer, ...rest } = f;
    saveFile({ ...rest, stlBuffer });
  });
  setPendingImports([]);
};

const cancelImport = () => {
  setPendingImports([]);
};
```

**Step 4: Update IndexedDB restore to include metadata**

In the `useEffect` that restores files from IndexedDB (lines 72–98), include `metadata` in the restored object:

```javascript
return {
  id: entry.id,
  name: entry.name,
  size: entry.size,
  type: entry.type,
  tags: entry.tags,
  thumbnail: entry.thumbnail,
  geometry,
  metadata: entry.metadata || null,
};
```

**Step 5: Verify manually**

Drop an STL file → should see `pendingImports` populated (verify via React DevTools or temporary console.log). No panel yet — that's the next task.

**Step 6: Commit**

```bash
git add src/App.jsx src/utils/db.js
git commit -m "feat: integrate metadata extraction into import pipeline with staging"
```

---

### Task 6: Import Review Panel Component

**Files:**
- Create: `src/components/ImportReviewPanel.jsx`
- Modify: `src/App.jsx` (render the panel when `pendingImports.length > 0`)

**Step 1: Create ImportReviewPanel**

A slide-up drawer that shows staged files. Each row has: thumbnail, filename, suggested tags (outline chips), type dropdown, collection input. A bottom bar has "apply to all" controls and Cancel/Import buttons.

```jsx
// src/components/ImportReviewPanel.jsx
import React, { useState } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';

const FILE_TYPES = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'tile', label: 'Tiles' },
  { value: 'prop', label: 'Props' },
  { value: 'scatter', label: 'Scatter' },
];

export default function ImportReviewPanel({ files, onConfirm, onCancel }) {
  const [editedFiles, setEditedFiles] = useState(() =>
    files.map((f) => ({
      ...f,
      // Copy suggestedTags so user can accept/dismiss per-file
      pendingSuggestions: [...(f.metadata?.suggestedTags || [])],
    }))
  );
  const [bulkCollection, setBulkCollection] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkType, setBulkType] = useState('');

  const updateFile = (id, updates) => {
    setEditedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const acceptSuggestion = (fileId, tag) => {
    setEditedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        if (f.tags.includes(tag)) {
          return { ...f, pendingSuggestions: f.pendingSuggestions.filter((t) => t !== tag) };
        }
        return {
          ...f,
          tags: [...f.tags, tag],
          pendingSuggestions: f.pendingSuggestions.filter((t) => t !== tag),
        };
      })
    );
  };

  const dismissSuggestion = (fileId, tag) => {
    setEditedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, pendingSuggestions: f.pendingSuggestions.filter((t) => t !== tag) }
          : f
      )
    );
  };

  const acceptAllSuggestions = (fileId) => {
    setEditedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const newTags = [...new Set([...f.tags, ...f.pendingSuggestions])];
        return { ...f, tags: newTags, pendingSuggestions: [] };
      })
    );
  };

  const addBulkTag = () => {
    const trimmed = bulkTag.trim();
    if (!trimmed) return;
    setEditedFiles((prev) =>
      prev.map((f) =>
        f.tags.includes(trimmed) ? f : { ...f, tags: [...f.tags, trimmed] }
      )
    );
    setBulkTag('');
  };

  const applyBulkCollection = () => {
    if (!bulkCollection.trim()) return;
    setEditedFiles((prev) =>
      prev.map((f) => ({
        ...f,
        metadata: { ...f.metadata, collection: bulkCollection.trim() },
      }))
    );
  };

  const applyBulkType = () => {
    if (!bulkType) return;
    setEditedFiles((prev) => prev.map((f) => ({ ...f, type: bulkType })));
  };

  const handleConfirm = () => {
    // Strip pendingSuggestions before saving, merge remaining suggestions into metadata
    const cleaned = editedFiles.map(({ pendingSuggestions, ...rest }) => ({
      ...rest,
      metadata: {
        ...rest.metadata,
        suggestedTags: pendingSuggestions, // keep unaccepted suggestions in metadata
      },
    }));
    onConfirm(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold">
            Import {editedFiles.length} file{editedFiles.length !== 1 && 's'}
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {editedFiles.map((file) => (
            <div key={file.id} className="flex gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-800">
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-950 flex-shrink-0">
                {file.thumbnail && (
                  <img src={file.thumbnail} alt="" className="w-full h-full object-contain" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>

                {/* Suggested tags */}
                {file.pendingSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1">Suggested:</span>
                    {file.pendingSuggestions.map((tag) => (
                      <span key={tag} className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-blue-300 border border-dashed border-blue-500/40 bg-blue-500/5">
                        {tag}
                        <button onClick={() => acceptSuggestion(file.id, tag)} className="text-emerald-400 hover:text-emerald-300">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => dismissSuggestion(file.id, tag)} className="text-gray-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => acceptAllSuggestions(file.id)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 ml-1"
                    >
                      Accept all
                    </button>
                  </div>
                )}

                {/* Confirmed tags */}
                {file.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {file.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Type + Collection row */}
                <div className="flex gap-3 items-center">
                  <select
                    value={file.type}
                    onChange={(e) => updateFile(file.id, { type: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {FILE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Collection..."
                    value={file.metadata?.collection || ''}
                    onChange={(e) =>
                      updateFile(file.id, {
                        metadata: { ...file.metadata, collection: e.target.value },
                      })
                    }
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bulk apply bar */}
        <div className="border-t border-gray-800 px-6 py-4 space-y-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Apply to all</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Collection for all..."
              value={bulkCollection}
              onChange={(e) => setBulkCollection(e.target.value)}
              onBlur={applyBulkCollection}
              onKeyDown={(e) => e.key === 'Enter' && applyBulkCollection()}
              className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Add tag to all..."
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBulkTag()}
                className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={addBulkTag}
                disabled={!bulkTag.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <select
              value={bulkType}
              onChange={(e) => { setBulkType(e.target.value); }}
              onBlur={applyBulkType}
              className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Type for all...</option>
              {FILE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Render ImportReviewPanel in App.jsx**

Add the panel in the JSX, after the drag overlay:

```jsx
import ImportReviewPanel from './components/ImportReviewPanel';

// In the render, after the drag overlay:
{pendingImports.length > 0 && (
  <ImportReviewPanel
    files={pendingImports}
    onConfirm={confirmImport}
    onCancel={cancelImport}
  />
)}
```

**Step 3: Verify manually**

Drop STL files → import review panel slides up → suggested tags shown as dashed chips → accept/dismiss → set type/collection → click Import → files appear in library with confirmed tags.

**Step 4: Commit**

```bash
git add src/components/ImportReviewPanel.jsx src/App.jsx
git commit -m "feat: add import review panel with tag suggestions and bulk apply"
```

---

### Task 7: Enhanced Detail Modal

**Files:**
- Modify: `src/App.jsx` (the detail modal section, lines 579–708)

**Step 1: Add metadata display sections to the modal**

Extend the modal content area (after the existing tag management section) with three new collapsible sections: Geometry, Print Estimate, and File Info.

Add these sections after the existing tag management `div` (line 703) and before the closing `</div>` of the modal content:

```jsx
{/* Geometry stats */}
{selectedFile.metadata && (
  <>
    <div className="border-t border-gray-800 pt-5 mt-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
        Geometry
      </h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Triangles</span>
          <p className="text-gray-200 font-medium">
            {selectedFile.metadata.triangleCount?.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Dimensions</span>
          <p className="text-gray-200 font-medium">
            {selectedFile.metadata.dimensions
              ? `${selectedFile.metadata.dimensions.x} x ${selectedFile.metadata.dimensions.y} x ${selectedFile.metadata.dimensions.z}`
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Surface Area</span>
          <p className="text-gray-200 font-medium">
            {selectedFile.metadata.surfaceArea?.toLocaleString()} mm²
          </p>
        </div>
        <div>
          <span className="text-gray-500">Watertight</span>
          <p className={`font-medium ${selectedFile.metadata.isWatertight ? 'text-emerald-400' : 'text-amber-400'}`}>
            {selectedFile.metadata.isWatertight ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
    </div>

    {/* Print estimate */}
    {selectedFile.metadata.printEstimate?.volumeCm3 != null && (
      <div className="border-t border-gray-800 pt-5 mt-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Print Estimate
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Volume</span>
            <p className="text-gray-200 font-medium">
              {selectedFile.metadata.printEstimate.volumeCm3} cm³
            </p>
          </div>
          <div>
            <span className="text-gray-500">Est. Weight</span>
            <p className="text-gray-200 font-medium">
              ~{selectedFile.metadata.printEstimate.estimatedGrams}g
            </p>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          Based on current print settings. Rough estimate only.
        </p>
      </div>
    )}

    {/* File info */}
    <div className="border-t border-gray-800 pt-5 mt-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
        File Info
      </h3>
      <div className="space-y-2 text-sm">
        {selectedFile.metadata.originalFilename && (
          <div className="flex justify-between">
            <span className="text-gray-500">Original</span>
            <span className="text-gray-300 font-mono text-xs">
              {selectedFile.metadata.originalFilename}
            </span>
          </div>
        )}
        {selectedFile.metadata.headerText && (
          <div className="flex justify-between">
            <span className="text-gray-500">Header</span>
            <span className="text-gray-300 text-xs truncate max-w-[200px]">
              {selectedFile.metadata.headerText}
            </span>
          </div>
        )}
        {selectedFile.metadata.importedAt && (
          <div className="flex justify-between">
            <span className="text-gray-500">Imported</span>
            <span className="text-gray-300 text-xs">
              {new Date(selectedFile.metadata.importedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  </>
)}
```

**Step 2: Add collection editing to the modal**

Add a collection field below the file name in the modal (between the name `h2` and the size/type badges):

```jsx
{/* Collection — editable */}
{selectedFile.metadata && (
  <div className="flex items-center gap-2 mt-1">
    <span className="text-xs text-gray-500">Collection:</span>
    <input
      type="text"
      value={selectedFile.metadata?.collection || ''}
      onChange={(e) => {
        const val = e.target.value;
        setSelectedFile((prev) => ({
          ...prev,
          metadata: { ...prev.metadata, collection: val },
        }));
      }}
      onBlur={() => {
        // Persist collection change
        setFiles((prev) =>
          prev.map((f) =>
            f.id === selectedFile.id
              ? { ...f, metadata: { ...f.metadata, collection: selectedFile.metadata.collection } }
              : f
          )
        );
        if (selectedFile.geometry) {
          updateFile(selectedFile.id, { metadata: selectedFile.metadata });
        }
      }}
      placeholder="Add to collection..."
      className="text-sm bg-transparent border-b border-gray-800 focus:border-blue-500 text-gray-300 placeholder-gray-600 outline-none py-0.5 flex-1"
    />
  </div>
)}
```

**Step 3: Verify manually**

Open a previously imported STL file → should see geometry stats, print estimate (if watertight), and file info sections. Collection field should be editable.

**Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add metadata display sections to detail modal"
```

---

### Task 8: Bulk Select Mode

**Files:**
- Create: `src/components/BulkActionBar.jsx`
- Modify: `src/App.jsx` (selection state, checkbox rendering, floating bar)

**Step 1: Add selection state to App.jsx**

```javascript
const [selectedIds, setSelectedIds] = useState(new Set());
const bulkMode = selectedIds.size > 0;

const toggleSelect = (id, e) => {
  e.stopPropagation();
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const selectAllFiltered = () => {
  setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
};

const clearSelection = () => setSelectedIds(new Set());

const bulkAddTags = (tags) => {
  setFiles((prev) =>
    prev.map((f) => {
      if (!selectedIds.has(f.id)) return f;
      const newTags = [...new Set([...f.tags, ...tags])];
      if (f.geometry) updateFile(f.id, { tags: newTags });
      return { ...f, tags: newTags };
    })
  );
};

const bulkSetType = (type) => {
  setFiles((prev) =>
    prev.map((f) => {
      if (!selectedIds.has(f.id)) return f;
      if (f.geometry) updateFile(f.id, { type });
      return { ...f, type };
    })
  );
};

const bulkSetCollection = (collection) => {
  setFiles((prev) =>
    prev.map((f) => {
      if (!selectedIds.has(f.id)) return f;
      const metadata = { ...(f.metadata || {}), collection };
      if (f.geometry) updateFile(f.id, { metadata });
      return { ...f, metadata };
    })
  );
};
```

**Step 2: Add checkboxes to file cards**

In the file card (inside the grid map, around line 493–557), add a checkbox overlay on the thumbnail area:

```jsx
{/* Checkbox overlay — shows on hover or when in bulk mode */}
<div
  className={`absolute top-2.5 left-2.5 z-10 transition-opacity ${
    bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`}
>
  <button
    onClick={(e) => toggleSelect(file.id, e)}
    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
      selectedIds.has(file.id)
        ? 'bg-blue-500 border-blue-500'
        : 'border-gray-400 bg-black/30 hover:border-blue-400'
    }`}
  >
    {selectedIds.has(file.id) && <Check className="w-4 h-4 text-white" />}
  </button>
</div>
```

Also add `Check` to the lucide-react import at top of App.jsx.

**Step 3: Add Escape key handler**

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && bulkMode) clearSelection();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [bulkMode]);
```

**Step 4: Create BulkActionBar component**

```jsx
// src/components/BulkActionBar.jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

const FILE_TYPES = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'tile', label: 'Tiles' },
  { value: 'prop', label: 'Props' },
  { value: 'scatter', label: 'Scatter' },
];

export default function BulkActionBar({
  count,
  totalFiltered,
  onAddTags,
  onSetType,
  onSetCollection,
  onSelectAll,
  onClear,
}) {
  const [tagInput, setTagInput] = useState('');
  const [collectionInput, setCollectionInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showCollectionInput, setShowCollectionInput] = useState(false);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      onAddTags(trimmed.split(',').map((t) => t.trim()).filter(Boolean));
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleSetCollection = () => {
    const trimmed = collectionInput.trim();
    if (trimmed) {
      onSetCollection(trimmed);
      setCollectionInput('');
      setShowCollectionInput(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50">
      <span className="text-sm font-semibold text-gray-200 whitespace-nowrap">
        {count} selected
      </span>

      <div className="w-px h-6 bg-gray-700" />

      {/* Add Tags */}
      {showTagInput ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="tag1, tag2..."
            autoFocus
            className="w-36 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-200 px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleAddTag} className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500">
            Add
          </button>
          <button onClick={() => setShowTagInput(false)} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Add Tags
        </button>
      )}

      {/* Set Type */}
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onSetType(e.target.value);
          e.target.value = '';
        }}
        className="bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
      >
        <option value="" disabled>Set Type</option>
        {FILE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Set Collection */}
      {showCollectionInput ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={collectionInput}
            onChange={(e) => setCollectionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetCollection()}
            placeholder="Collection name..."
            autoFocus
            className="w-36 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-200 px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleSetCollection} className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500">
            Set
          </button>
          <button onClick={() => setShowCollectionInput(false)} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCollectionInput(true)}
          className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Collection
        </button>
      )}

      <div className="w-px h-6 bg-gray-700" />

      {count < totalFiltered && (
        <button
          onClick={onSelectAll}
          className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
        >
          Select all {totalFiltered}
        </button>
      )}

      <button
        onClick={onClear}
        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
      >
        Deselect
      </button>
    </div>
  );
}
```

**Step 5: Render BulkActionBar in App.jsx**

Add after the main content area, before the detail modal:

```jsx
import BulkActionBar from './components/BulkActionBar';

// In JSX:
{bulkMode && (
  <BulkActionBar
    count={selectedIds.size}
    totalFiltered={filteredFiles.length}
    onAddTags={bulkAddTags}
    onSetType={bulkSetType}
    onSetCollection={bulkSetCollection}
    onSelectAll={selectAllFiltered}
    onClear={clearSelection}
  />
)}
```

**Step 6: Verify manually**

Hover over a card → checkbox appears → click to select → floating bar shows → add tags, set type, set collection for selected files → Escape to deselect → verify changes persisted.

**Step 7: Commit**

```bash
git add src/components/BulkActionBar.jsx src/App.jsx
git commit -m "feat: add bulk select mode with floating action bar"
```

---

### Task 9: Collection Filter in Sidebar

**Files:**
- Modify: `src/App.jsx` (add collection filter to sidebar, update filteredFiles)

**Step 1: Add collection state and filtering**

```javascript
const [selectedCollections, setSelectedCollections] = useState([]);

const allCollections = useMemo(() => {
  const cols = new Set();
  files.forEach((f) => {
    if (f.metadata?.collection) cols.add(f.metadata.collection);
  });
  return [...cols].sort();
}, [files]);

const toggleCollection = (col) =>
  setSelectedCollections((prev) =>
    prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
  );
```

Update `filteredFiles` to include collection filtering:

```javascript
const matchesCollection =
  selectedCollections.length === 0 ||
  selectedCollections.includes(file.metadata?.collection);
return matchesSearch && matchesType && matchesTags && matchesCollection;
```

Update `activeFilterCount` and `clearFilters` to include collections.

**Step 2: Add collection filter section to renderFilters**

Add after the Tags section in `renderFilters`:

```jsx
{/* Collection filters */}
{allCollections.length > 0 && (
  <div>
    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
      Collections
    </h3>
    <div className="space-y-1">
      {allCollections.map((col) => {
        const active = selectedCollections.includes(col);
        return (
          <button
            key={col}
            onClick={() => toggleCollection(col)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              active
                ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
            }`}
          >
            {col}
          </button>
        );
      })}
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add collection filter to sidebar"
```

---

### Task 10: Print Settings Popover

**Files:**
- Create: `src/components/PrintSettingsPopover.jsx`
- Modify: `src/App.jsx` (add settings button in detail modal)

**Step 1: Create PrintSettingsPopover**

A small popover with material dropdown and infill slider. Changes are saved to localStorage.

```jsx
// src/components/PrintSettingsPopover.jsx
import React, { useState } from 'react';
import { MATERIALS, getPrintSettings, savePrintSettings } from '../utils/printEstimate';

export default function PrintSettingsPopover({ onClose, onSave }) {
  const [settings, setSettings] = useState(getPrintSettings);

  const handleSave = () => {
    savePrintSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-4 z-50 space-y-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Print Settings
      </h4>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Material</label>
        <select
          value={settings.material}
          onChange={(e) => setSettings((s) => ({ ...s, material: e.target.value }))}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {Object.entries(MATERIALS).map(([key, { label, density }]) => (
            <option key={key} value={key}>
              {label} ({density} g/cm³)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          Infill: {settings.infillPercent}%
        </label>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={settings.infillPercent}
          onChange={(e) =>
            setSettings((s) => ({ ...s, infillPercent: +e.target.value }))
          }
          className="w-full accent-blue-500"
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Save Settings
      </button>
    </div>
  );
}
```

**Step 2: Add settings button in the detail modal's print estimate section**

Wire the `[⚙]` button to toggle the popover. When settings are saved, recalculate estimates for the selected file.

**Step 3: Commit**

```bash
git add src/components/PrintSettingsPopover.jsx src/App.jsx
git commit -m "feat: add print settings popover for material and infill configuration"
```

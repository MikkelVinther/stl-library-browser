# STL Metadata Extraction & Tagging System — Design

## Overview

Add automatic metadata extraction from STL files on import, and provide flexible tagging workflows for both individual and bulk editing.

## Data Model

### Extended File Object

```javascript
{
  // Existing fields
  id: number,
  name: string,
  size: string,
  type: string,
  tags: string[],
  thumbnail: string,

  // NEW: Auto-extracted metadata
  metadata: {
    // Geometry analysis
    triangleCount: number,
    dimensions: { x: number, y: number, z: number },
    volume: number | null,
    surfaceArea: number,
    isWatertight: boolean,

    // STL header
    headerText: string | null,

    // Filename parsing
    originalFilename: string,
    suggestedTags: string[],

    // File context
    importedAt: number,
    lastModified: number | null,
    collection: string | null,

    // Print estimates (derived from volume + app-wide settings)
    printEstimate: {
      volumeCm3: number | null,
      estimatedGrams: number | null,
    },
  }
}
```

### App-Wide Print Settings (localStorage)

```javascript
{
  material: 'PLA' | 'ABS' | 'PETG' | 'TPU' | 'Nylon' | 'Resin',
  infillPercent: number,  // 0-100, default 20
}
```

Material densities (g/cm3): PLA 1.24, ABS 1.04, PETG 1.27, TPU 1.21, Nylon 1.14, Resin 1.15.

## Auto-Extraction Pipeline

Three stages, all synchronous, run per file on import:

### 1. STL Header Parsing

- Read first 80 bytes of ArrayBuffer
- Decode as ASCII, trim null bytes and whitespace
- Store as `headerText` if non-empty and not gibberish

### 2. Filename Tokenization

- Strip `.stl` extension
- Split on `_`, `-`, spaces, and camelCase boundaries
- Filter noise: single chars, version strings (v1, v2), numbers-only, common filler (final, copy, fixed)
- Lowercase and deduplicate
- Store as `suggestedTags`

### 3. Geometry Analysis

- Triangle count from position attribute
- Bounding box via `geometry.computeBoundingBox()`
- Volume via signed tetrahedra method (divergence theorem)
- Surface area via triangle area summation
- Watertight check via edge-sharing heuristic
- Print estimate: `volumeCm3 * infillFactor * materialDensity`

## UI Components

### Import Review Panel

Slide-up drawer shown after files are dropped/selected, before adding to library.

- Per-file row: thumbnail, filename, suggested tag chips (outline style, click to accept/dismiss), type dropdown, collection input
- "Apply to all" bar: batch-set collection, tags, or type for entire import
- Cancel / Import buttons

### Enhanced Detail Modal

Extends existing modal with:

- Editable name and collection fields
- Geometry stats section (triangles, dimensions, surface area, watertight)
- Print estimate section with link to app-wide settings popover
- File info section (original filename, header text, import date, size)
- Improved tag management with suggested tags shown in distinct style

### Bulk Select Mode

- Checkbox on card hover; clicking enters bulk mode
- Persistent checkboxes while in bulk mode
- Floating action bar at bottom: Add Tags, Set Type, Set Collection, Deselect All
- "Select all filtered" option when filters are active
- Exit via Deselect All or Escape key

## IndexedDB Schema Changes

The `files` store gains the `metadata` object. Existing files without metadata continue to work (nullable fields). Geometry stats are computed once and persisted — not recomputed on load.

## Design Decisions

- `tags` (confirmed) stays separate from `suggestedTags` to avoid polluting the tag list
- `collection` is a first-class field, not just a tag
- Print estimates are rough volumetric comparisons, not slicer-accurate
- Print settings are app-wide (not per-file) since most users use one material
- All extraction is client-side, no server needed

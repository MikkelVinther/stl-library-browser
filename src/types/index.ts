import type { BufferGeometry } from 'three';

// ── File categories ──────────────────────────────────────────────────

export interface CategoryValues {
  creator?: string;
  collection?: string;
  role?: string;
  size?: string;
  fill?: string;
  creature?: string;
  race?: string;
  class?: string;
  [key: string]: string | undefined;
}

// ── Print estimate (stored in metadata) ──────────────────────────────

export interface PrintEstimate {
  volumeCm3: number | null;
  estimatedGrams: number | null;
}

// ── Geometry + file metadata stored in SQLite metadata_json ──────────

export interface STLMetadata {
  triangleCount: number;
  dimensions: { x: number; y: number; z: number };
  volume: number | null;
  surfaceArea: number;
  isWatertight: boolean;
  headerText: string | null;
  originalFilename: string;
  suggestedTags: string[];
  importedAt: number;
  lastModified: number | null;
  fileSize: number;
  printEstimate: PrintEstimate;
}

// ── Main file record (in memory + from DB) ───────────────────────────

export interface STLFile {
  id: string;
  name: string;
  relativePath: string;
  fullPath: string | null;
  directoryId?: string;
  /** Human-readable size string e.g. "1.2 MB" */
  size: string;
  sizeBytes: number;
  tags: string[];
  categories: CategoryValues;
  thumbnail: string | null;
  metadata?: STLMetadata;
  import_status?: 'confirmed' | 'pending';
}

// ── Directory entry ──────────────────────────────────────────────────

export interface DirectoryEntry {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastScannedAt?: number;
}

// ── Raw file info from directory scan ───────────────────────────────

export interface FileInfo {
  relativePath: string;
  fullPath: string | null;
  sizeBytes: number;
  lastModified: number;
  /** Present when file was dropped in the browser (not via Electron IPC) */
  _browserFile?: File;
}

// ── Import pipeline state ────────────────────────────────────────────

export interface ImportError {
  name: string;
  err: Error;
}

export interface ImportState {
  status: 'idle' | 'scanning' | 'processing' | 'reviewing';
  /** Files processed so far; grows during import */
  files: STLFile[];
  processed: number;
  total: number;
  currentName: string | null;
  errors: ImportError[];
}

// ── 3D viewer state ──────────────────────────────────────────────────

export interface ViewerState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  geometry: BufferGeometry | null;
}

// ── Print settings (stored in localStorage) ─────────────────────────

export interface PrintSettings {
  material: string;
  infillPercent: number;
}

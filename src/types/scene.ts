import type { BufferGeometry } from 'three';

// Persisted types (match DB schema)

export interface SceneMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  gridSize: number;       // mm per grid cell (default 25.4 = 1 inch)
  gridEnabled: boolean;
  cameraJson: string | null;
}

export interface SceneObjectData {
  id: string;
  sceneId: string;
  fileId: string;
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  color: string | null;
  sortOrder: number;
  // Joined from files table
  fileName: string;
  fileFullPath: string | null;
  fileThumbnail: string | null;
}

// Runtime types (in-memory during editing)

export interface SceneObject extends SceneObjectData {
  geometry: BufferGeometry | null;
  loadStatus: 'pending' | 'loading' | 'loaded' | 'error';
}

export interface SceneState {
  meta: SceneMeta;
  objects: SceneObject[];
  selectedObjectIds: string[];
  transformMode: 'translate' | 'rotate' | 'scale';
  /** Increments on every persisted-field mutation. */
  changeVersion: number;
  /** Last changeVersion successfully written to DB. */
  savedVersion: number;
  /** Non-null when the most recent save attempt failed. */
  lastSaveError: string | null;
}

export type AppView = 'library' | 'scene';

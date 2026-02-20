import { useState, useRef } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { STLFile, DirectoryEntry, ImportState } from '../types/index';
import {
  openFolder,
  scanDirectory,
  savePendingFile,
  confirmPendingFiles,
  cancelPendingFiles,
  saveDirectory,
  bulkSetCategoryValues,
} from '../utils/electronBridge';
import { processFiles } from '../utils/processFiles';
import { disposeRenderer } from '../utils/renderThumbnail';

const INITIAL_STATE: ImportState = {
  status: 'idle',
  files: [],
  processed: 0,
  total: 0,
  currentName: null,
  errors: [],
};

interface UseImportParams {
  addFiles: (files: STLFile[]) => void;
  setDirectories: Dispatch<SetStateAction<DirectoryEntry[]>>;
}

export function useImport({ addFiles, setDirectories }: UseImportParams) {
  const [importState, setImportState] = useState<ImportState>(INITIAL_STATE);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingWrites = useRef<Promise<void>[]>([]);

  // Batch buffer: avoids O(n²) spread on every file. Flushed every 50ms.
  const filesBuf = useRef<STLFile[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flushBuf() {
    const batch = filesBuf.current.splice(0);
    if (batch.length === 0) return;
    setImportState((prev) => ({ ...prev, files: [...prev.files, ...batch] }));
  }

  function flushAll() {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    flushBuf();
  }

  async function awaitPendingWrites() {
    await Promise.all(pendingWrites.current);
    pendingWrites.current = [];
  }

  /** Shared callbacks passed to processFiles — same logic for folder and drop imports. */
  function makeCallbacks(directoryId?: string) {
    return {
      directoryId,
      onFileProcessed: (entry: STLFile) => {
        pendingWrites.current.push(savePendingFile(entry));
        // Accumulate files in a ref; flush to state every 50ms to avoid O(n²)
        filesBuf.current.push(entry);
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(flushBuf, 50);
        // Increment counter immediately so the progress bar stays smooth
        setImportState((prev) => ({ ...prev, processed: prev.processed + 1 }));
      },
      onProgress: ({ currentName }: { currentName: string }) => {
        setImportState((prev) => ({ ...prev, currentName }));
      },
      onError: (name: string, err: unknown) => {
        console.error(`Failed to process ${name}:`, err);
        setImportState((prev) => ({
          ...prev,
          errors: [...prev.errors, { name, err: err as Error }],
          processed: prev.processed + 1,
        }));
      },
      shouldCancel: () => cancelRef.current,
    };
  }

  const handleOpenFolder = async () => {
    const folderPath = await openFolder();
    if (!folderPath) return;

    const dirName = folderPath.split('/').pop() || folderPath.split('\\').pop() || folderPath;
    // saveDirectory returns the canonical row: existing id on re-import, new id on first import.
    // This preserves FK-linked files when the same folder is opened again.
    const canonicalDir = await saveDirectory({ id: crypto.randomUUID(), name: dirName, path: folderPath, addedAt: Date.now() });
    setDirectories((prev) => {
      // Replace existing entry for this path (if any) or prepend
      const filtered = prev.filter((d) => d.path !== canonicalDir.path);
      return [canonicalDir, ...filtered];
    });

    setImportState((prev) => ({ ...prev, status: 'scanning' }));
    const fileInfos = await scanDirectory(folderPath);
    if (fileInfos.length === 0) {
      setImportState(INITIAL_STATE);
      return;
    }

    filesBuf.current = [];
    pendingWrites.current = [];
    setImportState({ status: 'processing', files: [], processed: 0, total: fileInfos.length, currentName: null, errors: [] });
    cancelRef.current = false;

    await processFiles(fileInfos, makeCallbacks(canonicalDir.id));
    flushAll();
    disposeRenderer();
    await awaitPendingWrites();

    setImportState((prev) => ({ ...prev, status: 'reviewing', currentName: null }));
  };

  const handleDroppedFiles = async (fileList: FileList) => {
    const stlFiles = [...fileList].filter((f) => f.name.toLowerCase().endsWith('.stl'));
    if (stlFiles.length === 0) return;

    const fileInfos = stlFiles.map((f) => ({
      relativePath: f.name,
      fullPath: (f as File & { path?: string }).path || null,
      sizeBytes: f.size,
      lastModified: f.lastModified,
      _browserFile: f,
    }));

    filesBuf.current = [];
    pendingWrites.current = [];
    setImportState({ status: 'processing', files: [], processed: 0, total: fileInfos.length, currentName: null, errors: [] });
    cancelRef.current = false;

    await processFiles(fileInfos, makeCallbacks());
    flushAll();
    disposeRenderer();
    await awaitPendingWrites();

    setImportState((prev) => ({ ...prev, status: 'reviewing', currentName: null }));
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleDroppedFiles(e.target.files);
    e.target.value = '';
  };

  const confirmImport = async (reviewedFiles: STLFile[]) => {
    await awaitPendingWrites();
    const ids = reviewedFiles.map((f) => f.id);
    await confirmPendingFiles(ids);
    const entries = reviewedFiles
      .filter((f) => f.categories && Object.keys(f.categories).length > 0)
      .map((f) => ({ fileId: f.id, categories: f.categories }));
    if (entries.length > 0) await bulkSetCategoryValues(entries);
    addFiles(reviewedFiles);
    setImportState(INITIAL_STATE);
  };

  const cancelImport = async () => {
    cancelRef.current = true;
    await awaitPendingWrites();
    await cancelPendingFiles();
    setImportState(INITIAL_STATE);
  };

  return {
    importState,
    fileInputRef,
    handleOpenFolder,
    handleDroppedFiles,
    handleFileInput,
    confirmImport,
    cancelImport,
  };
}

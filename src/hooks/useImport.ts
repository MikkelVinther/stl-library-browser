import { useState, useRef } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { STLFile, DirectoryEntry, ImportState, ImportError } from '../types/index';
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
  // Tracks { clientId -> canonicalDbId } for files written this session.
  // On re-import, the DB upsert may return a different (pre-existing) id.
  const idMap = useRef<Map<string, string>>(new Map());
  const pendingWrites = useRef<Promise<void>[]>([]);

  // Batch buffer: accumulates files during processing; flushed all at once on reviewing.
  const filesBuf = useRef<STLFile[]>([]);

  // rAF-batched progress state: coalesces processed/currentName/errors updates per frame.
  const stateUpdateBuf = useRef<{ processedDelta: number; currentName: string | null; newErrors: ImportError[] }>({
    processedDelta: 0,
    currentName: null,
    newErrors: [],
  });
  const rafHandle = useRef<number | null>(null);

  /** Flush accumulated progress updates synchronously (called before state transitions). */
  function drainStateUpdate() {
    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    }
    const { processedDelta, currentName, newErrors } = stateUpdateBuf.current;
    stateUpdateBuf.current = { processedDelta: 0, currentName: null, newErrors: [] };
    return { processedDelta, currentName, newErrors };
  }

  function scheduleStateFlush() {
    if (rafHandle.current !== null) return;
    rafHandle.current = requestAnimationFrame(() => {
      rafHandle.current = null;
      const { processedDelta, currentName, newErrors } = stateUpdateBuf.current;
      stateUpdateBuf.current = { processedDelta: 0, currentName: null, newErrors: [] };
      if (processedDelta === 0 && currentName === null && newErrors.length === 0) return;
      setImportState((prev) => ({
        ...prev,
        processed: prev.processed + processedDelta,
        ...(currentName !== null ? { currentName } : {}),
        ...(newErrors.length > 0 ? { errors: [...prev.errors, ...newErrors] } : {}),
      }));
    });
  }

  async function awaitPendingWrites() {
    while (pendingWrites.current.length > 0) {
      const batch = pendingWrites.current.splice(0);
      await Promise.all(batch);
    }
  }

  /** Shared callbacks passed to processFiles — same logic for folder and drop imports. */
  function makeCallbacks(directoryId?: string) {
    return {
      directoryId,
      onFileProcessed: (entry: STLFile) => {
        if (cancelRef.current) return;
        // savePendingFile returns the canonical DB id, which may differ from entry.id
        // when re-importing a directory whose files already exist in the DB.
        const writePromise = savePendingFile(entry).then((canonicalId) => {
          if (canonicalId && canonicalId !== entry.id) {
            idMap.current.set(entry.id, canonicalId);
          }
        });
        pendingWrites.current.push(writePromise);
        // Accumulate in ref only — set into state all at once when transitioning to reviewing
        filesBuf.current.push(entry);
        // Batch processed/currentName into a single rAF update per frame
        stateUpdateBuf.current.processedDelta += 1;
        stateUpdateBuf.current.currentName = entry.name;
        scheduleStateFlush();
      },
      onProgress: () => {
        // Progress is now handled entirely in onFileProcessed / onError
      },
      onError: (name: string, err: unknown) => {
        if (cancelRef.current) return;
        console.error(`Failed to process ${name}:`, err);
        stateUpdateBuf.current.processedDelta += 1;
        stateUpdateBuf.current.newErrors.push({ name, err: err as Error });
        stateUpdateBuf.current.currentName = name;
        scheduleStateFlush();
      },
      shouldCancel: () => cancelRef.current,
    };
  }

  /** Shared post-processing: drain buffers, transition through finalizing → reviewing. */
  async function finishImport() {
    disposeRenderer();

    // Drain any remaining rAF-buffered progress into the finalizing transition
    const { processedDelta, newErrors } = drainStateUpdate();
    setImportState((prev) => ({
      ...prev,
      status: 'finalizing',
      processed: prev.processed + processedDelta,
      errors: newErrors.length > 0 ? [...prev.errors, ...newErrors] : prev.errors,
      currentName: null,
    }));

    // Await all DB writes so idMap is fully populated with canonical IDs
    await awaitPendingWrites();

    // Set all accumulated files at once — zero renders during processing phase
    const allFiles = filesBuf.current.splice(0);

    // Rewrite any STLFile.id values that differ from the canonical DB ids
    if (idMap.current.size > 0) {
      const map = idMap.current;
      const canonicalFiles = allFiles.map((f) => {
        const canonical = map.get(f.id);
        return canonical ? { ...f, id: canonical } : f;
      });
      setImportState((prev) => ({ ...prev, status: 'reviewing', files: canonicalFiles }));
    } else {
      setImportState((prev) => ({ ...prev, status: 'reviewing', files: allFiles }));
    }

    idMap.current.clear();
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
    idMap.current.clear();
    stateUpdateBuf.current = { processedDelta: 0, currentName: null, newErrors: [] };
    setImportState({ status: 'processing', files: [], processed: 0, total: fileInfos.length, currentName: null, errors: [] });
    cancelRef.current = false;

    await processFiles(fileInfos, makeCallbacks(canonicalDir.id));
    await finishImport();
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
    idMap.current.clear();
    stateUpdateBuf.current = { processedDelta: 0, currentName: null, newErrors: [] };
    setImportState({ status: 'processing', files: [], processed: 0, total: fileInfos.length, currentName: null, errors: [] });
    cancelRef.current = false;

    await processFiles(fileInfos, makeCallbacks());
    await finishImport();
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
    // Cancel any pending rAF to avoid stale updates after cancel
    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    }
    stateUpdateBuf.current = { processedDelta: 0, currentName: null, newErrors: [] };
    await awaitPendingWrites();
    // Scope the delete to only this session's canonical DB ids to avoid
    // accidentally removing rows from a concurrent import session.
    const sessionIds = Array.from(idMap.current.values());
    await cancelPendingFiles(sessionIds.length > 0 ? sessionIds : undefined);
    idMap.current.clear();
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

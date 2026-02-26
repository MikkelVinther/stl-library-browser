import { useState, useMemo, useRef } from 'react';
import type { STLFile, ViewerState, CategoryValues, PrintSettings } from '../types/index';
import { updateFile, readFile } from '../utils/electronBridge';
import { estimateWeight } from '../utils/printEstimate';
import { loadSTLLoader } from '../utils/loadSTLLoader';
import { toArrayBuffer } from '../utils/bufferUtils';

interface UseFileDetailParams {
  updateFileInList: (id: string, updates: Partial<STLFile>) => void;
}

export function useFileDetail({ updateFileInList }: UseFileDetailParams) {
  const [selectedFile, setSelectedFile] = useState<STLFile | null>(null);
  const [fileTagsEdit, setFileTagsEdit] = useState<string[]>([]);
  const [fileCategoriesEdit, setFileCategoriesEdit] = useState<CategoryValues>({});
  const [newTag, setNewTag] = useState('');
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'idle', geometry: null });
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  // Request version counter — incremented on every openFile/closeFile to
  // invalidate in-flight loads. Stale completions compare their captured
  // version against the current value and bail out if mismatched.
  const requestVersionRef = useRef(0);

  const openFile = (file: STLFile) => {
    // Invalidate any in-flight load from a previous file
    requestVersionRef.current++;
    // Dispose any previous geometry before switching files
    viewerState.geometry?.dispose();
    setSelectedFile(file);
    setFileTagsEdit([...(file.tags || [])]);
    setFileCategoriesEdit({ ...(file.categories || {}) });
    setNewTag('');
    setViewerState({ status: 'idle', geometry: null });
  };

  const closeFile = () => {
    requestVersionRef.current++;
    viewerState.geometry?.dispose();
    setViewerState({ status: 'idle', geometry: null });
    setSelectedFile(null);
    setFileTagsEdit([]);
    setFileCategoriesEdit({});
    setNewTag('');
    setShowPrintSettings(false);
  };

  const handleLoad3D = async () => {
    if (!selectedFile?.fullPath) return;
    const version = ++requestVersionRef.current;
    // Dispose previous geometry if switching directly without closeFile
    viewerState.geometry?.dispose();
    setViewerState({ status: 'loading', geometry: null });
    try {
      const buffer = await readFile(selectedFile.fullPath);
      if (version !== requestVersionRef.current) return; // stale
      if (!buffer) { setViewerState({ status: 'error', geometry: null }); return; }
      const { STLLoader } = await loadSTLLoader();
      if (version !== requestVersionRef.current) return; // stale
      const loader = new STLLoader();
      const geometry = loader.parse(toArrayBuffer(buffer));
      geometry.computeVertexNormals();
      if (version !== requestVersionRef.current) {
        // Stale completion — dispose immediately to prevent leak
        geometry.dispose();
        return;
      }
      setViewerState({ status: 'loaded', geometry });
    } catch {
      if (version !== requestVersionRef.current) return; // stale
      setViewerState({ status: 'error', geometry: null });
    }
  };

  const addEditTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !fileTagsEdit.includes(trimmed)) {
      setFileTagsEdit((prev) => [...prev, trimmed]);
      setNewTag('');
    }
  };

  const removeEditTag = (tag: string) =>
    setFileTagsEdit((prev) => prev.filter((t) => t !== tag));

  const saveTags = async () => {
    if (!selectedFile) return;
    updateFileInList(selectedFile.id, { tags: fileTagsEdit });
    setSelectedFile((prev) => prev ? { ...prev, tags: fileTagsEdit } : null);
    try { await updateFile(selectedFile.id, { tags: fileTagsEdit }); }
    catch (e) { console.error('Failed to save tags:', e); }
  };

  const saveCategories = async () => {
    if (!selectedFile) return;
    updateFileInList(selectedFile.id, { categories: fileCategoriesEdit });
    setSelectedFile((prev) => prev ? { ...prev, categories: fileCategoriesEdit } : null);
    try { await updateFile(selectedFile.id, { categories: fileCategoriesEdit }); }
    catch (e) { console.error('Failed to save categories:', e); }
  };

  const savePrintSettings = (newSettings: PrintSettings) => {
    if (!selectedFile?.metadata?.printEstimate) return;
    const vol = selectedFile.metadata.printEstimate.volumeCm3;
    const newGrams = estimateWeight(vol != null ? vol * 1000 : null, newSettings);
    const updatedMeta = {
      ...selectedFile.metadata,
      printEstimate: { ...selectedFile.metadata.printEstimate, estimatedGrams: newGrams },
    };
    setSelectedFile((prev) => prev ? { ...prev, metadata: updatedMeta } : null);
    updateFileInList(selectedFile.id, { metadata: updatedMeta });
    updateFile(selectedFile.id, { metadata: updatedMeta });
  };

  const tagsChanged = useMemo(() => {
    if (!selectedFile) return false;
    const a = fileTagsEdit.slice().sort();
    const b = (selectedFile.tags || []).slice().sort();
    return a.length !== b.length || a.some((t, i) => t !== b[i]);
  }, [fileTagsEdit, selectedFile]);

  const categoriesChanged = useMemo(() => {
    if (!selectedFile) return false;
    // Normalise: only compare entries with non-empty values, sorted by key
    const toEntries = (obj: CategoryValues) =>
      Object.entries(obj).filter(([, v]) => v != null && v !== '').sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(toEntries(fileCategoriesEdit)) !== JSON.stringify(toEntries(selectedFile.categories || {}));
  }, [fileCategoriesEdit, selectedFile]);

  return {
    selectedFile,
    fileTagsEdit,
    fileCategoriesEdit,
    setFileCategoriesEdit,
    newTag,
    setNewTag,
    viewerState,
    showPrintSettings,
    setShowPrintSettings,
    openFile,
    closeFile,
    handleLoad3D,
    addEditTag,
    removeEditTag,
    saveTags,
    saveCategories,
    savePrintSettings,
    tagsChanged,
    categoriesChanged,
  };
}

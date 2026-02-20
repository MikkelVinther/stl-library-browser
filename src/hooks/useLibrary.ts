import { useState, useMemo, useEffect } from 'react';
import type { STLFile, DirectoryEntry } from '../types/index';
import {
  getAllFiles,
  getAllDirectories,
  updateFile,
  bulkSetCategoryValue,
} from '../utils/electronBridge';
import { CATEGORY_IDS } from '../utils/categoryClassifier';

export function useLibrary() {
  const [files, setFiles] = useState<STLFile[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);

  useEffect(() => {
    getAllFiles().then((saved) => {
      setFiles(saved.map((f) => ({ ...f, geometry: null })));
      setIsRestoring(false);
    });
    getAllDirectories().then(setDirectories);
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    files.forEach((f) => f.tags?.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [files]);

  const categoryFacets = useMemo(() => {
    const facets: Record<string, Record<string, number>> = {};
    for (const catId of CATEGORY_IDS) {
      const values: Record<string, number> = {};
      for (const f of files) {
        const val = f.categories?.[catId];
        if (val) values[val] = (values[val] || 0) + 1;
      }
      if (Object.keys(values).length > 0) facets[catId] = values;
    }
    return facets;
  }, [files]);

  const addFiles = (newFiles: STLFile[]) => {
    setFiles((prev) => [...newFiles, ...prev]);
  };

  const updateFileInList = (id: string, updates: Partial<STLFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const bulkAddTags = (selectedIds: Set<string>, tags: string[]) => {
    const updates: { id: string; tags: string[] }[] = [];
    setFiles((prev) =>
      prev.map((f) => {
        if (!selectedIds.has(f.id)) return f;
        const newTags = [...new Set([...(f.tags || []), ...tags])];
        updates.push({ id: f.id, tags: newTags });
        return { ...f, tags: newTags };
      })
    );
    for (const { id, tags: newTags } of updates) {
      updateFile(id, { tags: newTags }).catch((e) =>
        console.error('Failed to bulk-save tags:', e)
      );
    }
  };

  const bulkSetCategory = (selectedIds: Set<string>, catId: string, value: string) => {
    const ids = [...selectedIds];
    setFiles((prev) =>
      prev.map((f) => {
        if (!selectedIds.has(f.id)) return f;
        return { ...f, categories: { ...(f.categories || {}), [catId]: value } };
      })
    );
    bulkSetCategoryValue(ids, catId, value);
  };

  return {
    files,
    setFiles,
    isRestoring,
    directories,
    setDirectories,
    allTags,
    categoryFacets,
    addFiles,
    updateFileInList,
    bulkAddTags,
    bulkSetCategory,
  };
}

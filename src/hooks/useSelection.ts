import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import type { STLFile } from '../types/index';

export function useSelection(filteredFiles: STLFile[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkMode = selectedIds.size > 0;

  const toggleSelect = (id: string, e: MouseEvent) => {
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

  // Escape key clears bulk selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && bulkMode) clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkMode]);

  return { selectedIds, bulkMode, toggleSelect, selectAllFiltered, clearSelection };
}

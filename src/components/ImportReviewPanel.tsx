import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, Loader2, ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../utils/categoryClassifier';
import type { STLFile } from '../types/index';

interface ImportReviewPanelProps {
  files: STLFile[];
  onConfirm: (files: STLFile[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  processedCount?: number;
  totalCount?: number;
}

export default function ImportReviewPanel({
  files,
  onConfirm,
  onCancel,
  isProcessing = false,
  processedCount = 0,
  totalCount = 0,
}: ImportReviewPanelProps) {
  const [editedFiles, setEditedFiles] = useState<STLFile[]>(() => [...files]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedValue, setExpandedValue] = useState<string | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<{ catId: string; oldValue: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const prevLenRef = useRef(files.length);

  // Append new files as they arrive from the streaming pipeline
  useEffect(() => {
    if (files.length > prevLenRef.current) {
      const newFiles = files.slice(prevLenRef.current);
      setEditedFiles((prev) => [...prev, ...newFiles]);
    }
    prevLenRef.current = files.length;
  }, [files.length]);

  // Build category summary
  const categorySummary = useMemo(() => {
    return CATEGORY_IDS.map((catId) => {
      const groups = {};
      const unclassified = [];
      for (const file of editedFiles) {
        const val = file.categories?.[catId];
        if (val) {
          (groups[val] ||= []).push(file);
        } else {
          unclassified.push(file);
        }
      }
      const totalFiles = editedFiles.length;
      const classifiedCount = totalFiles - unclassified.length;
      const classifiedPct = totalFiles > 0 ? classifiedCount / totalFiles : 0;
      return {
        id: catId,
        label: CATEGORY_LABELS[catId],
        groups,
        unclassified,
        classifiedPct,
      };
    });
  }, [editedFiles]);

  const updateFileCategories = (fileIds: Set<string>, catId: string, newValue: string | undefined) => {
    setEditedFiles((prev) =>
      prev.map((f) => {
        if (!fileIds.has(f.id)) return f;
        const categories = { ...f.categories };
        if (newValue) {
          categories[catId] = newValue;
        } else {
          delete categories[catId];
        }
        return { ...f, categories };
      })
    );
  };

  const handleRename = (catId, oldValue) => {
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === oldValue) {
      setRenamingGroup(null);
      return;
    }
    const affectedIds = new Set(
      editedFiles.filter((f) => f.categories?.[catId] === oldValue).map((f) => f.id)
    );
    updateFileCategories(affectedIds, catId, trimmed);
    setRenamingGroup(null);
    // Update expanded value if it was renamed
    if (expandedValue === oldValue) setExpandedValue(trimmed);
  };

  const handleAddValue = (catId) => {
    const trimmed = newValueInput.trim();
    if (!trimmed || selectedFileIds.size === 0) {
      setAddingTo(null);
      setNewValueInput('');
      return;
    }
    updateFileCategories(selectedFileIds, catId, trimmed);
    setSelectedFileIds(new Set());
    setAddingTo(null);
    setNewValueInput('');
  };

  const handleReassign = (catId, newValue) => {
    if (selectedFileIds.size === 0) return;
    updateFileCategories(selectedFileIds, catId, newValue);
    setSelectedFileIds(new Set());
  };

  const toggleFileSelect = (fileId) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(editedFiles);
  };

  const headerText = isProcessing
    ? `Importing... (${processedCount} of ${totalCount})`
    : `Import ${editedFiles.length} file${editedFiles.length !== 1 ? 's' : ''}`;

  const expandedFiles = expandedCategory && expandedValue
    ? categorySummary
        .find((c) => c.id === expandedCategory)
        ?.groups[expandedValue] || []
    : expandedCategory && expandedValue === null
    ? []
    : [];

  // Show unclassified files when clicking "unclassified" chip
  const [showUnclassified, setShowUnclassified] = useState<string | null>(null); // catId
  const unclassifiedFiles = showUnclassified
    ? categorySummary.find((c) => c.id === showUnclassified)?.unclassified || []
    : [];

  const visibleThumbnails = expandedValue ? expandedFiles : unclassifiedFiles;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {isProcessing && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
            <h2 className="text-lg font-bold">{headerText}</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Category summary */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {categorySummary.map((cat) => {
            const groupEntries = Object.entries(cat.groups).sort((a, b) => b[1].length - a[1].length);
            const isExpanded = expandedCategory === cat.id;
            // Auto-collapse categories with <10% classified
            const autoCollapsed = cat.classifiedPct < 0.1 && !isExpanded;

            return (
              <div key={cat.id} className="border border-gray-800 rounded-xl overflow-hidden">
                {/* Category header row */}
                <button
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedCategory(null);
                      setExpandedValue(null);
                      setShowUnclassified(null);
                      setSelectedFileIds(new Set());
                    } else {
                      setExpandedCategory(cat.id);
                      setExpandedValue(null);
                      setShowUnclassified(null);
                      setSelectedFileIds(new Set());
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-gray-300 w-24 text-left flex-shrink-0">
                    {cat.label}
                  </span>

                  {/* Value chips */}
                  <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                    {autoCollapsed ? (
                      <span className="text-xs text-gray-600">
                        {groupEntries.length > 0
                          ? `${groupEntries.length} value${groupEntries.length !== 1 ? 's' : ''}`
                          : 'no values detected'}
                      </span>
                    ) : (
                      <>
                        {groupEntries.map(([value, files]) => (
                          <span
                            key={value}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              expandedValue === value && isExpanded
                                ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 ring-1 ring-gray-700'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCategory(cat.id);
                              setExpandedValue(expandedValue === value && isExpanded ? null : value);
                              setShowUnclassified(null);
                              setSelectedFileIds(new Set());
                            }}
                          >
                            {value}
                            <span className="text-[10px] text-gray-500 ml-0.5">
                              {files.length}
                            </span>
                          </span>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Unclassified count */}
                  {cat.unclassified.length > 0 && (
                    <span
                      className={`text-xs flex-shrink-0 cursor-pointer transition-colors ${
                        showUnclassified === cat.id
                          ? 'text-amber-400'
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCategory(cat.id);
                        setExpandedValue(null);
                        setShowUnclassified(showUnclassified === cat.id ? null : cat.id);
                        setSelectedFileIds(new Set());
                      }}
                    >
                      {cat.unclassified.length} unclassified
                    </span>
                  )}
                </button>

                {/* Expanded area — thumbnail strip + actions */}
                {isExpanded && (expandedValue || showUnclassified === cat.id) && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                    {/* Actions bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Rename (only for classified groups) */}
                      {expandedValue && (
                        <>
                          {renamingGroup?.catId === cat.id && renamingGroup?.oldValue === expandedValue ? (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(cat.id, expandedValue);
                                  if (e.key === 'Escape') setRenamingGroup(null);
                                }}
                                autoFocus
                                className="bg-gray-800 border border-gray-600 rounded-lg text-xs text-gray-200 px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleRename(cat.id, expandedValue)}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => setRenamingGroup(null)}
                                className="p-1 text-gray-500 hover:text-gray-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setRenamingGroup({ catId: cat.id, oldValue: expandedValue });
                                setRenameInput(expandedValue);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                              Rename group
                            </button>
                          )}
                        </>
                      )}

                      {/* Reassign selected files */}
                      {selectedFileIds.size > 0 && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[10px] text-gray-500">
                            {selectedFileIds.size} selected — move to:
                          </span>
                          {Object.keys(cat.groups)
                            .filter((v) => v !== expandedValue)
                            .map((v) => (
                              <button
                                key={v}
                                onClick={() => handleReassign(cat.id, v)}
                                className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
                              >
                                {v}
                              </button>
                            ))}
                          {/* New value input */}
                          {addingTo === cat.id ? (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={newValueInput}
                                onChange={(e) => setNewValueInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddValue(cat.id);
                                  if (e.key === 'Escape') { setAddingTo(null); setNewValueInput(''); }
                                }}
                                placeholder="New value..."
                                autoFocus
                                className="bg-gray-800 border border-gray-600 rounded text-[10px] text-gray-200 px-1.5 py-0.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleAddValue(cat.id)}
                                className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-500"
                              >
                                Move
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddingTo(cat.id)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-400 hover:text-blue-300"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              New
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thumbnail grid */}
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {visibleThumbnails.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => toggleFileSelect(file.id)}
                          className={`relative w-16 h-16 rounded-lg overflow-hidden bg-gray-950 flex-shrink-0 border-2 transition-all ${
                            selectedFileIds.has(file.id)
                              ? 'border-blue-500 ring-1 ring-blue-500/30'
                              : 'border-transparent hover:border-gray-600'
                          }`}
                          title={file.name}
                        >
                          {file.thumbnail ? (
                            <img src={file.thumbnail} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-700 text-[8px]">
                              STL
                            </div>
                          )}
                          {selectedFileIds.has(file.id) && (
                            <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-gray-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {editedFiles.length} file{editedFiles.length !== 1 ? 's' : ''} ready to import
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Import All'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X, Layers } from 'lucide-react';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../utils/categoryClassifier';

interface BulkActionBarProps {
  count: number;
  totalFiltered: number;
  onAddTags: (tags: string[]) => void;
  onSetCategory: (catId: string, value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onNewScene?: () => void;
  hasFilesWithoutPath?: boolean;
}

export default function BulkActionBar({
  count,
  totalFiltered,
  onAddTags,
  onSetCategory,
  onSelectAll,
  onClear,
  onNewScene,
  hasFilesWithoutPath = false,
}: BulkActionBarProps) {
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [catInput, setCatInput] = useState('');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      onAddTags(trimmed.split(',').map((t) => t.trim()).filter(Boolean));
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleSetCategory = () => {
    const trimmed = catInput.trim();
    if (trimmed && activeCatId) {
      onSetCategory(activeCatId, trimmed);
      setCatInput('');
      setActiveCatId(null);
    }
  };

  return (
    <div className="fixed bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 lg:px-5 py-3 overlay-panel rounded-2xl max-w-[calc(100vw-1rem)] overflow-x-auto">
      <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">
        {count} selected
      </span>

      <div className="w-px h-6 bg-[rgba(146,173,220,0.24)]" />

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
            className="ui-input w-36 text-xs px-2 py-1.5"
          />
          <button onClick={handleAddTag} className="ui-btn ui-btn-primary px-2 py-1.5 text-xs">
            Add
          </button>
          <button onClick={() => setShowTagInput(false)} className="ui-btn ui-btn-ghost p-1.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="ui-btn ui-btn-secondary px-3 py-1.5 text-xs font-medium whitespace-nowrap"
        >
          Add Tags
        </button>
      )}

      {/* Set Category */}
      {activeCatId ? (
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-faint whitespace-nowrap">{CATEGORY_LABELS[activeCatId]}:</span>
          <input
            type="text"
            value={catInput}
            onChange={(e) => setCatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSetCategory();
              if (e.key === 'Escape') { setActiveCatId(null); setCatInput(''); }
            }}
            placeholder="Value..."
            autoFocus
            className="ui-input w-24 text-xs px-2 py-1.5"
          />
          <button onClick={handleSetCategory} className="ui-btn ui-btn-primary px-2 py-1.5 text-xs">
            Set
          </button>
          <button onClick={() => { setActiveCatId(null); setCatInput(''); }} className="ui-btn ui-btn-ghost p-1.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setActiveCatId(e.target.value);
            e.target.value = '';
          }}
          className="ui-input text-xs px-2 py-1.5 cursor-pointer min-w-[118px]"
        >
          <option value="" disabled>Set Category</option>
          {CATEGORY_IDS.map((catId) => (
            <option key={catId} value={catId}>{CATEGORY_LABELS[catId]}</option>
          ))}
        </select>
      )}

      <div className="w-px h-6 bg-[rgba(146,173,220,0.24)]" />

      {onNewScene && (
        <button
          onClick={onNewScene}
          disabled={hasFilesWithoutPath}
          title={hasFilesWithoutPath ? 'Some selected files are missing from disk and cannot be added to a scene' : 'Open selected files in scene builder'}
          className="ui-btn ui-btn-secondary px-3 py-1.5 text-xs font-medium whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Layers className="w-3.5 h-3.5" />
          New Scene
        </button>
      )}

      <div className="w-px h-6 bg-[rgba(146,173,220,0.24)]" />

      {count < totalFiltered && (
        <button
          onClick={onSelectAll}
          className="ui-btn ui-btn-ghost px-3 py-1.5 text-xs text-cyan-200 whitespace-nowrap"
        >
          Select all {totalFiltered}
        </button>
      )}

      <button
        onClick={onClear}
        className="ui-btn ui-btn-ghost px-3 py-1.5 text-xs whitespace-nowrap"
      >
        Deselect
      </button>
    </div>
  );
}
